#!/usr/bin/env python3
"""Live verification for BRAIN SPARK 60.

Usage: python3 tests/live_check.py [base_url]

Checks the deployed build: 1-minute lobby, 13 mini-games (including the four new
ones), a live challenge-link intake, ranking badge, reload persistence and one
full 60-second bot run.
"""
import os, sys, json, re, time, base64
os.environ.setdefault('LD_LIBRARY_PATH', '/workspace/.local/chromium-libs/usr/lib/x86_64-linux-gnu:' + os.environ.get('LD_LIBRARY_PATH', ''))

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://wodnr2295-design.github.io/Brain-spark-30/').rstrip('/')
URL = BASE + '/index.html?test=1'
SHOTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tests', 'live')
os.makedirs(SHOTS, exist_ok=True)

from playwright.sync_api import sync_playwright

CHECKS = []
ERRORS = []

def check(name, cond, detail=''):
    CHECKS.append({'name': name, 'pass': bool(cond), 'detail': str(detail)})
    print(('PASS  ' if cond else 'FAIL  ') + name + (('  — ' + str(detail)) if detail else ''))
    return cond

BOT = """() => {
  const host = document.getElementById('game-host');
  const gid = host?.dataset.game;
  if (gid === 'stopwatch') {
    const armed = host.querySelector('.st-btn[data-hit="1"]');
    if (armed) armed.click();
    return gid;
  }
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

def state(page):
    return page.evaluate('window.__BS30_TEST__.state()')

def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name))

def token(rec):
    return base64.urlsafe_b64encode(json.dumps(rec, ensure_ascii=False).encode()).decode().rstrip('=')

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                                  permissions=['clipboard-read', 'clipboard-write'])
        page = ctx.new_page()
        page.on('console', lambda m: ERRORS.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: ERRORS.append(('pageerror', str(e))))
        page.goto(URL, wait_until='networkidle')
        page.wait_for_timeout(1300)

        check('live build boots into the lobby', page.eval_on_selector('.screen.active', 'e => e.dataset.screen') == 'lobby')
        check('live title is the 60-second build', '브레인 스파크 60' in page.title(), page.title())
        check('lobby shows the 1-minute challenge', '1분' in page.inner_text('.cta-main'))
        check('thirteen training chips are deployed', page.eval_on_selector_all('.gs-item', 'els => els.length') == 13,
              page.eval_on_selector_all('.gs-item', 'els => els.length'))
        shot(page, '01_live_lobby.png')

        # new games mount and score
        for gid in ['judge', 'stopwatch', 'pattern', 'flash']:
            page.evaluate(f'window.__BS30_TEST__.start("training", "{gid}")')
            page.wait_for_timeout(700)
            host_game = page.eval_on_selector('#game-host', 'e => e.dataset.game')
            has_ui = page.eval_on_selector('#game-host', 'e => e.querySelectorAll(".g *").length > 3')
            check(f'live training {gid} mounts', host_game == gid and has_ui, host_game)
            if gid in ('judge', 'pattern'):
                shot(page, f'02_live_{gid}.png')
            t0 = time.time()
            score = 0
            while time.time() - t0 < 2.6:
                page.evaluate(BOT)
                score = page.evaluate('window.__BS30_SESSION__?.score ?? 0')
                if score > 0:
                    break
                page.wait_for_timeout(50)
            check(f'live training {gid} scores', score > 0, score)
            page.evaluate('window.__BS30_SESSION__ && window.__BS30_SESSION__.end()')
            page.wait_for_timeout(600)
            if page.eval_on_selector('#result-layer', 'e => !e.hidden'):
                page.evaluate('window.__BS30_TEST__.closeResult()')
                page.wait_for_timeout(150)

        # full 60s challenge
        page.evaluate('window.__BS30_TEST__.start("challenge")')
        page.wait_for_timeout(400)
        clock = page.eval_on_selector('#game-time', 'e => e.textContent')
        check('live timer starts at one minute', float(clock) > 58.0, clock)
        t0 = time.time()
        while time.time() - t0 < 64:
            page.evaluate(BOT)
            if page.eval_on_selector('#result-layer', 'e => !e.hidden'):
                break
            page.wait_for_timeout(45)
        elapsed = time.time() - t0
        check('live challenge runs 60 seconds', 57.0 <= elapsed <= 64.5, f'{elapsed:.1f}s')
        page.wait_for_timeout(900)
        result = page.evaluate('window.__BS30_TEST__.result()')
        check('live result has a score and grade', bool(result and result['score'] > 0 and result['grade']['grade']),
              result and f"{result['score']} {result['grade']['grade']}")
        check('live result shows 60S CHALLENGE', '60S CHALLENGE' in page.inner_text('.result-card'))
        shot(page, '03_live_result.png')

        page.click('[data-res="challenge"]')
        page.wait_for_timeout(450)
        clip = page.evaluate('navigator.clipboard.readText()')
        check('live result copies a challenge link', '?c=' in clip, clip[:80])

        # challenge link intake on a clean profile
        friend_ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        fp = friend_ctx.new_page()
        fp.on('console', lambda m: ERRORS.append(('friend:' + m.type, m.text)) if m.type in ('error', 'warning') else None)
        fp.on('pageerror', lambda e: ERRORS.append(('friend:pageerror', str(e))))
        tok = token({'v': 1, 'n': '지민', 's': 21400, 'm': 420, 'a': 88, 'c': 26,
                     'av': 'tiger', 'fr': 'gold', 'ti': 'fast', 'md': 'c', 't': int(time.time() * 1000)})
        fp.goto(URL + '&c=' + tok, wait_until='networkidle')
        fp.wait_for_timeout(1200)
        fs = state(fp)
        check('live challenge link registers the friend', len(fs['friends']) == 1 and fs['friends'][0]['name'] == '지민', fs['friends'])
        banner = fp.inner_text('.challenge-banner') if fp.eval_on_selector_all('.challenge-banner', 'els => els.length') else ''
        check('live lobby shows the challenge banner', '지민님의 도전장' in banner and '21,400' in banner, banner.replace('\n', ' / '))
        check('live address bar is cleaned', 'c=' not in fp.url, fp.url)
        shot(fp, '04_live_challenge_banner.png')
        fp.evaluate('window.__BS30_TEST__.tab("rank")')
        fp.wait_for_timeout(450)
        check('live ranking shows the friend badge',
              fp.eval_on_selector_all('.rk-me-tag.friend, .p-friend', 'els => els.length') >= 1)
        check('live ranking lists the friend', '지민' in fp.inner_text('.screen.active'))
        shot(fp, '05_live_challenge_rank.png')
        fp.reload(wait_until='networkidle')
        fp.wait_for_timeout(1000)
        fs2 = state(fp)
        check('live friend survives reload', len(fs2['friends']) == 1, len(fs2['friends']))
        friend_ctx.close()

        check('live has no console errors or warnings', len(ERRORS) == 0, ERRORS[:5])
        browser.close()

    passed = sum(1 for c in CHECKS if c['pass'])
    print(f'\n{passed}/{len(CHECKS)} live checks passed')
    with open(os.path.join(os.path.dirname(SHOTS), 'LIVE_REPORT.json'), 'w') as f:
        json.dump({'url': BASE, 'passed': passed, 'total': len(CHECKS), 'checks': CHECKS, 'console': ERRORS}, f, ensure_ascii=False, indent=2)
    sys.exit(0 if passed == len(CHECKS) else 1)

if __name__ == '__main__':
    main()
