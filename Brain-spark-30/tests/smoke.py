#!/usr/bin/env python3
"""Quick smoke: serve the app, boot it in Chromium, print console errors + screenshot."""
import os, sys, functools, threading, http.server, socketserver
os.environ.setdefault('LD_LIBRARY_PATH', '/workspace/.local/chromium-libs/usr/lib/x86_64-linux-gnu:' + os.environ.get('LD_LIBRARY_PATH', ''))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    handler = functools.partial(Quiet, directory=ROOT)
    class Server(socketserver.TCPServer):
        allow_reuse_address = True
        def server_bind(self):
            self.socket.setsockopt(1, 2, 1)  # SO_REUSEADDR
            super().server_bind()
    httpd = Server(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd.server_address[1]

port = serve()
from playwright.sync_api import sync_playwright

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
    page.goto(f'http://127.0.0.1:{port}/index.html?test=1', wait_until='networkidle')
    page.wait_for_timeout(1600)
    page.screenshot(path=os.path.join(ROOT, 'tests', 'smoke_lobby.png'), full_page=False)
    print('title:', page.title())
    print('active screen:', page.eval_on_selector('.screen.active', 'el => el.dataset.screen'))
    print('errors:', errors)
    b.close()
