"""Exercise real HTTP responses under a Windows-style incorrect .mjs registry."""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import importlib.util
import mimetypes
import tempfile
import threading
import unittest
from urllib.request import urlopen

spec = importlib.util.spec_from_file_location('farm_local_server', Path(__file__).resolve().parents[1] / 'tools' / 'serve.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LocalServerTest(unittest.TestCase):
    def test_module_bytes_and_mime_ignore_incorrect_host_registry(self):
        previous = mimetypes.guess_type('fixture.mjs')[0]
        mimetypes.add_type('text/plain', '.mjs')
        try:
            with tempfile.TemporaryDirectory(prefix='farm-http-mime-') as directory:
                source = b'export const ready = true;\r\n'
                Path(directory, 'fixture.mjs').write_bytes(source)
                Path(directory, 'fixture.js').write_bytes(source)
                Path(directory, 'fixture.json').write_bytes(b'{"ready":true}')
                server = ThreadingHTTPServer(('127.0.0.1', 0), partial(module.FarmRequestHandler, directory=directory))
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                try:
                    for filename, content_type, expected in [
                        ('fixture.mjs', 'text/javascript', source),
                        ('fixture.js', 'text/javascript', source),
                        ('fixture.json', 'application/json', b'{"ready":true}'),
                    ]:
                        with self.subTest(filename=filename), urlopen(f'http://127.0.0.1:{server.server_port}/{filename}') as response:
                            self.assertEqual(response.headers.get_content_type(), content_type)
                            self.assertEqual(response.read(), expected)
                finally:
                    server.shutdown()
                    server.server_close()
                    thread.join()
        finally:
            if previous:
                mimetypes.add_type(previous, '.mjs')
            else:
                mimetypes.types_map.pop('.mjs', None)


if __name__ == '__main__':
    unittest.main()
