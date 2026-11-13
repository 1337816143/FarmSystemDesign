"""Build a relocatable, local-only Windows package without installing dependencies.

Build machine needs Node. Target machine needs neither Python nor Node nor Office.
Original author binaries are copied unchanged and attributed; no Git operation occurs.
"""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import shutil
import subprocess
import uuid
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PYTHON_SHA256 = '90905e64a840557d8c1bc4f5b74db3d7ee85e3ffb217611cac1c7813acea4159'
PYTHON_URL = 'https://www.python.org/ftp/python/3.14.10/python-3.14.10-embed-amd64.zip'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def make_manifest(app):
    entries = [{'path': path.relative_to(app).as_posix(), 'bytes': path.stat().st_size, 'sha256': sha(path)}
               for path in app.rglob('*') if path.is_file() and path.relative_to(app).as_posix() not in {'offline-manifest.json', '.nojekyll'}]
    entries.sort(key=lambda item: item['path'])
    identifier = hashlib.sha256(json.dumps(entries, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    return {'schema': 1, 'id': identifier, 'version': json.loads((app / 'version.json').read_text(encoding='utf-8'))['version'],
            'totalFiles': len(entries), 'totalBytes': sum(item['bytes'] for item in entries), 'entries': entries,
            'excludedControlFiles': ['.nojekyll'],
            'scope': 'Portable local website assets. Native computation and folder storage require the bundled local server; external live services are excluded.'}


def build(destination, runtime, python_zip):
    destination = destination.resolve()
    runtime = runtime.resolve(strict=True)
    if destination.exists():
        raise ValueError('Choose a new output folder; existing versions are never overwritten.')
    if sha(python_zip) != PYTHON_SHA256:
        raise ValueError('Embedded Python SHA-256 does not match the official Python 3.14.10 release.')
    identity = json.loads((runtime / 'source-identity.json').read_text(encoding='utf-8'))
    for name, expected in identity['hashes'].items():
        if sha(runtime / name) != expected:
            raise ValueError('Native source identity mismatch: ' + name)
    subprocess.run(['node', 'tools/build.mjs'], cwd=ROOT, check=True)
    destination.mkdir(parents=True)
    app = destination / 'app'
    shutil.copytree(ROOT / '_site', app)
    for name in ['serve.py', 'farmdesign/__init__.py', 'farmdesign/service.py', 'farmdesign/worker.ps1', 'farmdesign/NativeHost.cs', 'farmdesign/NativeUi.cs', 'farmdesign/native-ui.ps1', 'farmdesign/native_ui.py']:
        target = app / 'tools' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / 'tools' / name, target)
    engine = destination / 'engine'
    for name in ['Bin', 'Input', 'Docs']:
        shutil.copytree(runtime / name, engine / name, ignore=shutil.ignore_patterns('*.ldb'))
    (engine / 'Output').mkdir()
    tree = ET.parse(engine / 'Bin/applConfig.FarmDESIGN.ini')
    for element in tree.getroot().findall('element'):
        if element.findtext('name') == 'InputDirectoryPath': element.find('value').text = 'Input\\'
        if element.findtext('name') == 'OutputDirectoryPath': element.find('value').text = 'Output\\'
    tree.write(engine / 'Bin/applConfig.FarmDESIGN.ini', encoding='utf-8', xml_declaration=True)
    identity['source'] = 'Bundled original author package in engine/; attribution and hashes preserved'
    write_json(engine / 'source-identity.json', identity)
    python = destination / 'runtime/python'
    python.mkdir(parents=True)
    with zipfile.ZipFile(python_zip) as archive:
        for name in archive.namelist():
            (python / name).resolve().relative_to(python.resolve())
        archive.extractall(python)
    launcher = destination / 'launcher'
    launcher.mkdir()
    for name in ['launch.py', 'check-windows.ps1']:
        shutil.copy2(ROOT / 'tools/portable' / name, launcher / name)
    shutil.copy2(ROOT / 'tools/portable/bridge.js', app / 'portable-state.js')
    for entry in [app / 'index.html', app / 'route-b/index.html']:
        text = entry.read_text(encoding='utf-8')
        text = text.replace('<head>', '<head>\n<script src="/portable-state.js"></script>', 1)
        entry.write_text(text, encoding='utf-8', newline='\n')
    worker = app / 'sw.js'
    text = worker.read_text(encoding='utf-8')
    text = text.replace("relative.startsWith('api/farmdesign/')", "relative.startsWith('api/')")
    worker.write_text(text, encoding='utf-8', newline='\n')
    (destination / 'UserData/Projects').mkdir(parents=True)
    shutil.copy2(ROOT / 'tools/portable/README.md', destination / '使用说明.md')
    for filename, option in [('启动Farm.cmd', ''), ('停止Farm.cmd', '--stop')]:
        (destination / filename).write_text('@echo off\r\nstart "" "%~dp0runtime\\python\\pythonw.exe" -I -B "%~dp0launcher\\launch.py" ' + option + '\r\n', encoding='ascii', newline='')
    (destination / '检查运行环境.cmd').write_text('@echo off\r\n"%~dp0runtime\\python\\python.exe" -I -B "%~dp0launcher\\launch.py" --self-test\r\npause\r\n', encoding='ascii', newline='')
    config = {'application': 'FarmSystemDesign.Portable', 'packageId': str(uuid.uuid4()), 'port': 4184,
              'engineVersion': '4.21.5.0', 'pythonVersion': '3.14.10', 'platform': 'Windows 10/11 x64 Intel/AMD',
              'dataMode': 'UserData/workspace.json', 'internetRequired': False}
    write_json(destination / 'portable-config.json', config)
    manifest = make_manifest(app)
    (app / 'offline-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    attribution = {'builtAt': datetime.datetime.now().astimezone().isoformat(), 'localSourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip(),
                   'farmdesign': {key: value for key, value in identity.items() if key != 'source'},
                   'python': {'version': '3.14.10', 'url': PYTHON_URL, 'archiveSHA256': PYTHON_SHA256, 'license': 'runtime/python/LICENSE.txt'},
                   'sourceFiles': {str(path.relative_to(ROOT)).replace('\\', '/'): sha(path) for path in [Path(__file__), *(ROOT / 'tools/portable').glob('*')] if path.is_file()},
                   'noInstall': True, 'noPush': True}
    write_json(destination / '来源与构建信息.json', attribution)
    files = [{'path': path.relative_to(destination).as_posix(), 'bytes': path.stat().st_size, 'sha256': sha(path)}
             for path in destination.rglob('*') if path.is_file()]
    files.sort(key=lambda item: item['path'])
    write_json(destination / '便携包校验清单.json', {'schema': 1, 'files': files, 'count': len(files), 'bytes': sum(item['bytes'] for item in files),
               'mutableDirectories': ['UserData', 'engine/sessions', 'engine/Output'], 'notice': 'UserData is initially empty; later edits are user data and are not part of the immutable application manifest.'})
    print(json.dumps({'destination': str(destination), 'files': len(files), 'bytes': sum(item['bytes'] for item in files), 'python': '3.14.10', 'native': '4.21.5.0'}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--python-zip', type=Path, required=True)
    args = parser.parse_args()
    build(args.output, args.runtime, args.python_zip)
