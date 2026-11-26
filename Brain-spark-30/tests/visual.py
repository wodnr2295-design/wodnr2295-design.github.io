#!/usr/bin/env python3
"""Visual pass: capture lobby, tabs, game rounds, result for eyeballing."""
import os, sys, functools, threading, http.server, socketserver
os.environ.setdefault('LD_LIBRARY_PATH', '/workspace/.local/chromium-libs/usr/lib/x86_64-linux-gnu:' + os.environ.get('LD_LIBRARY_PATH', ''))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    handler = functools.partial(Quiet, directory=ROOT)
    class Server(socketserver.TCPServer):
        allow_reuse_address = True
    httpd = Server(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd.server_address[1]

port = serve()
from playwright.sync_api import sync_playwright

BOT = """() => {
  const host = document.getElementById('game-host');
  const gid = host?.dataset.game;
  const ok = [...host.querySelectorAll('[data-ok="1"]')];
  if (!ok.length) return gid || null;
  if (gid === 'order' || gid === 'memory') {
    const live = ok.filter(e => !e.disabled).sort((a,b) => (a.dataset.step||0) - (b.dataset.step||0));
    if (live.length) live[0].click();
    return gid;
  }
  ok[0].click();
  return gid;
}"""

SHOTS = os.path.join(ROOT, 'tests')
errors = []

def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name))

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
    page.goto(f'http://127.0.0.1:{port}/index.html?test=1', wait_until='networkidle')
    page.wait_for_timeout(1200)

    for tab in ['rank', 'rewards', 'shop', 'records']:
        page.evaluate(f'window.__BS30_TEST__.tab("{tab}")')
        page.wait_for_timeout(600)
        shot(page, f'v_{tab}.png')
    page.evaluate('window.__BS30_TEST__.tab("lobby")')
    page.wait_for_timeout(400)

    # start a challenge and grab a few round shots
    page.evaluate('window.__BS30_TEST__.start("challenge")')
    page.wait_for_timeout(420)
    shot(page, 'v_game1.png')
    seen = {}
    for i in range(900):
        gid = page.evaluate(BOT)
        if gid and gid not in seen:
            seen[gid] = True
            page.wait_for_timeout(120)
            shot(page, f'v_round_{gid}.png')
        if page.eval_on_selector('#result-layer', 'e => !e.hidden'):
            break
        page.wait_for_timeout(45)
    page.wait_for_timeout(900)
    shot(page, 'v_result.png')
    print('games seen:', sorted(seen))
    print('result:', page.evaluate('window.__BS30_TEST__.result() && {score: window.__BS30_TEST__.result().score, grade: window.__BS30_TEST__.result().grade.grade, acc: window.__BS30_TEST__.result().accuracy, ms: window.__BS30_TEST__.result().avgMs, combo: window.__BS30_TEST__.result().maxCombo, coins: window.__BS30_TEST__.result().coins, rounds: window.__BS30_TEST__.result().rounds}'))
    print('errors:', errors)
    b.close()
