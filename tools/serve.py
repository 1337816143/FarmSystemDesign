"""Serve the local Farm workspace with explicit browser-module MIME types.

Windows registry entries can map .mjs to text/plain. Module scripts must receive
a JavaScript MIME type regardless of the host's file-association settings.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
from urllib.parse import urlsplit


class FarmRequestHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.wasm': 'application/wasm',
        '.json': 'application/json',
        '.geojson': 'application/geo+json',
        '.webmanifest': 'application/manifest+json',
    }

    def _farmdesign_api(self, body=None):
        path=urlsplit(self.path).path
        if not path.startswith('/api/farmdesign/'):
            return False
        if self.client_address[0] not in ('127.0.0.1','::1'):
            self.send_error(403,'Native calculation is local only')
            return True
        if urlsplit('http://'+self.headers.get('Host','')).hostname not in ('127.0.0.1','localhost','::1'):
            self.send_error(403,'Native calculation requires a loopback host')
            return True
        origin=self.headers.get('Origin')
        if origin and origin!='http://'+self.headers.get('Host',''):
            self.send_error(403,'Cross-origin calculation is not allowed')
            return True
        try:
            service=getattr(self.server,'farmdesign_service',None)
            if service is None:
                raise RuntimeError('Native FarmDESIGN service is unavailable in this server')
            result=service.dispatch(path[len('/api/farmdesign/'):],body)
            self._json(200,result)
        except (ValueError,TypeError,KeyError) as error:
            self._json(400,{'error':str(error)})
        except Exception as error:
            self._json(500,{'error':str(error)})
        return True

    def _json(self,status,value):
        payload=json.dumps(value,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(payload)))
        self.send_header('Cache-Control','no-store')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if not self._farmdesign_api():
            super().do_GET()

    def do_POST(self):
        if not urlsplit(self.path).path.startswith('/api/farmdesign/'):
            self.send_error(404)
            return
        if self.headers.get_content_type()!='application/json':
            self._json(415,{'error':'Expected application/json'})
            return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=8*1024*1024:
                raise ValueError('Request must be within 8 MB')
            body=json.loads(self.rfile.read(size).decode('utf-8'))
            if not isinstance(body,dict):raise ValueError('Expected JSON object')
        except (ValueError,UnicodeError) as error:
            self._json(400,{'error':str(error)})
            return
        self._farmdesign_api(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4173)
    parser.add_argument('--bind', default='127.0.0.1')
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--farmdesign-runtime',type=Path)
    args = parser.parse_args()
    directory = args.directory.resolve(strict=True)
    if not directory.is_dir():
        parser.error('--directory must be an existing directory')
    if not 1 <= args.port <= 65535:
        parser.error('--port must be in 1..65535')
    server = ThreadingHTTPServer((args.bind, args.port), partial(FarmRequestHandler, directory=str(directory)))
    from farmdesign.service import FarmDesignService
    server.farmdesign_service=FarmDesignService(args.farmdesign_runtime)
    print(f'Farm local workspace: http://{args.bind}:{args.port}/', flush=True)
    print(f'Serving: {directory}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.farmdesign_service.close()
        server.server_close()


if __name__ == '__main__':
    main()
