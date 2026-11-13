"""Folder-contained launcher/server. Uses only the bundled Python standard library."""
from pathlib import Path
import argparse
import ctypes
import datetime
import functools
import hashlib
import json
import os
import platform
import secrets
import subprocess
import sys
import threading
import time
import traceback
import urllib.request
import webbrowser

BASE = Path(__file__).resolve().parents[1]
APP = BASE / 'app'
DATA = BASE / 'UserData'
ENGINE = BASE / 'engine'
sys.path.insert(0, str(APP / 'tools'))
from serve import FarmRequestHandler, ThreadingHTTPServer
from farmdesign.service import FarmDesignService


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    with temporary.open('w', encoding='utf-8', newline='\n') as file:
        json.dump(value, file, ensure_ascii=False, allow_nan=False, indent=2)
        file.write('\n')
        file.flush()
        os.fsync(file.fileno())
    os.replace(temporary, path)


def allowed_key(key):
    return isinstance(key, str) and key.startswith('farmsystem-') and len(key) < 200


class FolderStore:
    def __init__(self, directory):
        self.path = directory / 'workspace.json'
        self.lock = threading.RLock()
        self.value = read_json(self.path) if self.path.exists() else {'schema': 1, 'revision': 0, 'storage': {}}
        if self.value.get('schema') != 1 or not isinstance(self.value.get('storage'), dict):
            raise ValueError('UserData/workspace.json is invalid. Restore workspace.previous.json; the invalid file has been preserved.')
        if any(not allowed_key(key) or not isinstance(value, str) for key, value in self.value['storage'].items()):
            raise ValueError('Invalid saved workspace fields; original file has been preserved.')

    def get(self):
        with self.lock:
            return dict(self.value, storage=dict(self.value['storage']))

    def mutate(self, operation):
        with self.lock:
            values = dict(self.value['storage'])
            kind, key = operation.get('operation'), operation.get('key')
            if kind == 'clear':
                values = {}
            elif kind in {'set', 'remove'} and allowed_key(key):
                if kind == 'set':
                    if not isinstance(operation.get('value'), str):
                        raise ValueError('Storage values must be strings')
                    values[key] = operation['value']
                else:
                    values.pop(key, None)
            else:
                raise ValueError('Invalid storage operation')
            following = {'schema': 1, 'revision': self.value['revision'] + 1,
                         'savedAt': datetime.datetime.now().astimezone().isoformat(), 'storage': values}
            if len(json.dumps(following, ensure_ascii=False).encode('utf-8')) > 12 * 1024 * 1024:
                raise ValueError('Workspace exceeds 12 MB; export and archive older projects first')
            if self.path.exists():
                write_json(self.path.with_name('workspace.previous.json'), self.value)
            write_json(self.path, following)
            self.value = following
            return {'saved': True, 'revision': following['revision']}


def preflight():
    if os.name != 'nt' or platform.machine().lower() not in {'amd64', 'x86_64'}:
        raise RuntimeError('This edition requires Intel/AMD 64-bit Windows 10/11.')
    if sys.getwindowsversion().major < 10:
        raise RuntimeError('Windows 10/11 is required.')
    powershell = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'SysWOW64/WindowsPowerShell/v1.0/powershell.exe'
    if not powershell.exists():
        raise RuntimeError('Windows 32-bit PowerShell is unavailable; this Windows edition cannot run the original engine.')
    (DATA / 'Logs').mkdir(parents=True, exist_ok=True)
    probe = DATA / '.write-test'
    probe.write_text('test', encoding='ascii')
    probe.unlink()
    result = subprocess.run([str(powershell), '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                             '-File', str(BASE / 'launcher/check-windows.ps1'), '-Database', str(ENGINE / 'Input/FarmDB.mdb')],
                            capture_output=True, text=True, encoding='utf-8', timeout=30,
                            creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError('Windows component check failed (.NET Framework / 32-bit Jet): ' + result.stdout + result.stderr)
    return json.loads(result.stdout)


class Handler(FarmRequestHandler):
    def _portable_api(self, body=None):
        path = self.path.split('?', 1)[0]
        if not path.startswith('/api/portable/'):
            return False
        from urllib.parse import urlsplit
        host = self.headers.get('Host', '')
        if self.client_address[0] != '127.0.0.1' or urlsplit('http://' + host).hostname != '127.0.0.1':
            self.send_error(403)
            return True
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + host:
            self.send_error(403)
            return True
        try:
            if path == '/api/portable/status' and body is None:
                self._json(200, {'application': 'FarmSystemDesign.Portable', 'packageId': self.server.package_id,
                                 'instanceId': self.server.instance_id, 'dataMode': 'folder', 'engine': '4.21.5.0'})
            elif path == '/api/portable/storage':
                result = self.server.folder_store.get() if body is None else self.server.folder_store.mutate(body)
                self._json(200, result)
            elif path == '/api/portable/stop' and body is not None and secrets.compare_digest(str(body.get('token', '')), self.server.stop_token):
                self._json(200, {'stopping': True})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
            else:
                self._json(404, {'error': 'Unknown portable command'})
        except (ValueError, TypeError, KeyError) as error:
            self._json(400, {'error': str(error)})
        except OSError as error:
            self._json(500, {'error': 'Folder save failed: ' + str(error)})
        return True

    def do_GET(self):
        if not self._portable_api():
            super().do_GET()

    def do_POST(self):
        if not self.path.startswith('/api/portable/'):
            return super().do_POST()
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if self.headers.get_content_type() != 'application/json' or not 0 < size <= 12 * 1024 * 1024:
                raise ValueError('Expected JSON within 12 MB')
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError('Expected JSON object')
        except (ValueError, TypeError) as error:
            return self._json(400, {'error': str(error)})
        self._portable_api(body)

    def end_headers(self):
        # A local server always supplies the exact installed folder contents.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def existing_instance():
    path = DATA / 'running.json'
    if not path.exists():
        return None
    try:
        info = read_json(path)
        if info.get('folder') != str(BASE) or not info.get('url', '').startswith('http://127.0.0.1:'):
            return None
        with urllib.request.urlopen(info['url'] + 'api/portable/status', timeout=2) as response:
            status = json.load(response)
        if status.get('instanceId') == info['instanceId']:
            return info
    except (OSError, ValueError, KeyError):
        pass
    return None


def self_test():
    report = {'windows': preflight(), 'python': sys.version, 'pythonExecutable': str(Path(sys.executable)), 'base': str(BASE)}
    service = FarmDesignService(ENGINE)
    try:
        capability = service.capabilities()
        if not capability['ready']:
            raise RuntimeError(capability.get('error'))
        case = read_json(APP / 'data/farmdesign/author-cases-2019.json')['cases'][0]
        result = service.evaluate(case)
        assert abs(result['modules']['Budget']['FreeBudget'] - 61895117.19154998) < 1e-5
        assert len(result['modules']) == 20
        report.update(status='PASS', engine=result['engineVersion'], nativeModules=20,
                      budget=result['modules']['Budget']['FreeBudget'])
        write_json(DATA / 'Logs/self-test.json', report)
        return report
    finally:
        service.close()


def run(args):
    DATA.mkdir(parents=True, exist_ok=True)
    existing = existing_instance()
    if args.stop:
        if existing:
            request = urllib.request.Request(existing['url'] + 'api/portable/stop',
                       data=json.dumps({'token': existing['stopToken']}).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=10) as response:
                return json.load(response)
        return {'stopping': False, 'message': 'This folder is not running.'}
    if args.self_test:
        return self_test()
    if args.check:
        return {'windows': preflight(), 'status': 'PASS'}
    if existing:
        if not args.no_browser:
            webbrowser.open(existing['url'] + '#farmdesign')
        return {'reused': True, 'url': existing['url']}
    import msvcrt
    instance_lock = (DATA / '.instance.lock').open('a+b')
    instance_lock.seek(0)
    if not instance_lock.read(1):
        instance_lock.write(b'0'); instance_lock.flush()
    instance_lock.seek(0)
    try:
        msvcrt.locking(instance_lock.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        instance_lock.close()
        for _ in range(100):
            existing = existing_instance()
            if existing:
                if not args.no_browser: webbrowser.open(existing['url'] + '#farmdesign')
                return {'reused': True, 'url': existing['url']}
            time.sleep(.2)
        raise RuntimeError('This folder is already starting or stopping. Wait a moment and try again.')
    check = preflight()
    store = FolderStore(DATA)
    configuration = read_json(BASE / 'portable-config.json')
    port = args.port if args.port is not None else configuration.get('port', 4184)
    try:
        server = ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=str(APP)))
    except OSError:
        # Keep the preferred origin whenever possible; never stop another service.
        server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(APP)))
    server.folder_store = store
    server.package_id = configuration['packageId']
    server.instance_id = secrets.token_hex(24)
    server.stop_token = secrets.token_hex(32)
    server.farmdesign_service = FarmDesignService(ENGINE)
    ready = server.farmdesign_service.capabilities()
    if not ready['ready']:
        server.farmdesign_service.close()
        server.server_close()
        raise RuntimeError(ready.get('error', 'Native engine unavailable'))
    url = f'http://127.0.0.1:{server.server_port}/'
    info = {'url': url, 'instanceId': server.instance_id, 'stopToken': server.stop_token, 'pid': os.getpid(), 'folder': str(BASE)}
    write_json(DATA / 'running.json', info)
    write_json(DATA / 'Logs/last-start.json', {'status': 'ready', 'url': url, 'windows': check, 'python': sys.version,
                                               'base': str(BASE), 'engineReady': ready['ready']})
    if not args.no_browser:
        webbrowser.open(url + '#farmdesign')
    try:
        server.serve_forever(poll_interval=.2)
    except KeyboardInterrupt:
        pass
    finally:
        server.farmdesign_service.close()
        server.server_close()
        instance_lock.close()
        running = DATA / 'running.json'
        if running.exists() and read_json(running).get('instanceId') == server.instance_id:
            running.unlink()
    return {'stopped': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stop', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--port', type=int)
    arguments = parser.parse_args()
    (DATA / 'Logs').mkdir(parents=True, exist_ok=True)
    log = (DATA / 'Logs/server.log').open('a', encoding='utf-8', buffering=1)
    if sys.stdout is None:
        sys.stdout = log
    sys.stderr = log
    try:
        print(json.dumps(run(arguments), ensure_ascii=False))
    except Exception as error:
        traceback.print_exc(file=log)
        if not arguments.no_browser and not arguments.check and not arguments.self_test:
            ctypes.windll.user32.MessageBoxW(None, str(error) + '\n\n详情：UserData/Logs/server.log', 'Farm 便携版启动失败', 0x10)
        sys.exit(1)
