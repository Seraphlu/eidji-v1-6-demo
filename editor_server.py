from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from datetime import datetime
import base64
import json
import shutil
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / 'js' / 'data.js'
BACKUP_DIR = ROOT / 'js' / 'data-backups'
OWNER = 'Seraphlu'
REPO = 'eidji-v1-6-demo'


def github_request(method, path, token, payload=None):
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    request = urllib.request.Request(
        'https://api.github.com' + path,
        data=data,
        method=method,
        headers={
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'Eidji-Editor-Server',
            'Content-Type': 'application/json',
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode('utf-8'))


def get_github_token():
    result = subprocess.run(
        ['git', 'credential', 'fill'],
        input='protocol=https\nhost=github.com\n\n',
        text=True,
        capture_output=True,
        cwd=str(ROOT),
        timeout=20,
    )
    if result.returncode != 0:
        raise RuntimeError('无法读取 GitHub 登录凭据，请先在本机登录 GitHub。')
    for line in result.stdout.splitlines():
        if line.startswith('password='):
            return line[len('password='):]
    raise RuntimeError('没有找到 GitHub 凭据。')


def save_data(content):
    if 'window.EIDJI_DATA' not in content:
        raise ValueError('保存内容不是有效的 data.js。')
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backup = None
    if DATA_FILE.exists():
        stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        backup = BACKUP_DIR / ('data-' + stamp + '.js')
        shutil.copy2(DATA_FILE, backup)
    DATA_FILE.write_bytes(content.encode('utf-8'))
    return backup


def publish_data(content):
    save_data(content)
    token = get_github_token()
    ref = github_request('GET', f'/repos/{OWNER}/{REPO}/git/ref/heads/main', token)
    parent_sha = ref['object']['sha']
    parent = github_request('GET', f'/repos/{OWNER}/{REPO}/git/commits/{parent_sha}', token)
    blob = github_request('POST', f'/repos/{OWNER}/{REPO}/git/blobs', token, {
        'content': base64.b64encode(DATA_FILE.read_bytes()).decode('ascii'),
        'encoding': 'base64',
    })
    tree = github_request('POST', f'/repos/{OWNER}/{REPO}/git/trees', token, {
        'base_tree': parent['tree']['sha'],
        'tree': [{
            'path': 'js/data.js',
            'mode': '100644',
            'type': 'blob',
            'sha': blob['sha'],
        }],
    })
    commit = github_request('POST', f'/repos/{OWNER}/{REPO}/git/commits', token, {
        'message': 'Update story text from visual editor',
        'tree': tree['sha'],
        'parents': [parent_sha],
    })
    github_request('PATCH', f'/repos/{OWNER}/{REPO}/git/refs/heads/main', token, {
        'sha': commit['sha'],
        'force': False,
    })
    return commit['sha']


class EditorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        print('%s - %s' % (self.address_string(), format % args))

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/api/health':
            self.send_json(200, {'ok': True, 'local': True})
            return
        super().do_GET()

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            payload = json.loads(self.rfile.read(length).decode('utf-8')) if length else {}
            content = payload.get('content', '')
            if self.path == '/api/save-data':
                backup = save_data(content)
                self.send_json(200, {
                    'ok': True,
                    'backup': str(backup.relative_to(ROOT)) if backup else None,
                })
                return
            if self.path == '/api/publish':
                commit = publish_data(content)
                self.send_json(200, {'ok': True, 'commit': commit})
                return
            self.send_json(404, {'ok': False, 'error': 'Unknown API endpoint.'})
        except Exception as error:
            self.send_json(500, {'ok': False, 'error': str(error)})


def main():
    address = ('127.0.0.1', 8765)
    server = ThreadingHTTPServer(address, EditorHandler)
    print('Eidji story editor: http://127.0.0.1:8765/editor.html')
    print('Press Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
