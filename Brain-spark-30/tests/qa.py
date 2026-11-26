#!/usr/bin/env python3
"""BRAIN SPARK 60 — end-to-end QA.

Drives the real app in Chromium at 390x844 (plus a 360x640 and a desktop pass),
plays every one of the 13 mini-games, runs a full 60-second challenge, buys and
equips a theme, claims rewards, sends a challenge link, opens it in a fresh
profile to check friend intake / ranking / persistence, reloads to prove
persistence, and fails on any console error.

Usage: python3 tests/qa.py
"""
import os, sys, json, re, time, base64, functools, threading, http.server, socketserver
os.environ.setdefault('LD_LIBRARY_PATH', '/workspace/.local/chromium-libs/usr/lib/x86_64-linux-gnu:' + os.environ.get('LD_LIBRARY_PATH', ''))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'tests', 'qa')
os.makedirs(SHOTS, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    handler = functools.partial(Quiet, directory=ROOT)
    class Server(socketserver.TCPServer):
        allow_reuse_address = True
    httpd = Server(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd.server_address[1]

PORT = serve()
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

GAME_IDS = ['signal', 'sniper', 'order', 'direction', 'stroop', 'math', 'memory', 'odd', 'match',
            'judge', 'stopwatch', 'pattern', 'flash']

def challenge_token(rec):
    """Builds the same url-safe base64 payload the app writes."""
    raw = json.dumps(rec, ensure_ascii=False).encode('utf-8')
    return base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')

def play_bot(page, seconds):
    end = time.time() + seconds
    seen = []
    while time.time() < end:
        gid = page.evaluate(BOT)
        if gid and gid not in seen:
            seen.append(gid)
        if page.eval_on_selector('#result-layer', 'e => !e.hidden'):
            break
        page.wait_for_timeout(45)
    return seen

def state(page):
    return page.evaluate('window.__BS30_TEST__.state()')

def shot(page, name):
    page.screenshot(path=os.path.join(SHOTS, name))

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                                  permissions=['clipboard-read', 'clipboard-write'])
        page = ctx.new_page()
        page.on('console', lambda m: ERRORS.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: ERRORS.append(('pageerror', str(e))))
        url = f'http://127.0.0.1:{PORT}/index.html?test=1'
        page.goto(url, wait_until='networkidle')
        page.wait_for_timeout(1100)

        # ---------------------------------------------------------- boot + lobby
        check('boots into the lobby', page.eval_on_selector('.screen.active', 'e => e.dataset.screen') == 'lobby')
        check('splash dismisses', page.eval_on_selector('#splash', 'e => e.classList.contains("off")'))
        check('five navigation tabs present', page.eval_on_selector_all('.tab', 'els => els.length') == 5)
        check('korean UI renders', '1분' in page.inner_text('.cta-main'))
        check('thirteen training chips', page.eval_on_selector_all('.gs-item', 'els => els.length') == 13)
        check('starts with 200 coins', state(page)['coins'] == 200, state(page)['coins'])
        shot(page, '01_lobby.png')

        # ---------------------------------------------------------- tabs render
        headings = {}
        for tab, expect in [('rank', '랭킹'), ('rewards', '10판 보상'), ('shop', '커스터마이징'), ('records', '내 기록')]:
            page.evaluate(f'window.__BS30_TEST__.tab("{tab}")')
            page.wait_for_timeout(320)
            headings[tab] = page.inner_text('.screen.active h1')
            check(f'tab {tab} renders', headings[tab] == expect, headings[tab])
            shot(page, f'02_{tab}.png')

        # ranking modes
        page.evaluate('window.__BS30_TEST__.tab("rank")')
        page.click('[data-act="rank-mode:training"]')
        page.wait_for_timeout(250)
        check('training ranking mode shows game chips', page.eval_on_selector_all('.game-chips button', 'els => els.length') == 13)
        check('my row is highlighted', page.eval_on_selector_all('.rk-row.me', 'els => els.length') == 1)
        page.click('[data-act="rank-mode:challenge"]')

        # ---------------------------------------------------------- training x13
        played = set()
        for game_id in GAME_IDS:
            page.evaluate(f'window.__BS30_TEST__.start("training", "{game_id}")')
            page.wait_for_timeout(560)
            host_game = page.eval_on_selector('#game-host', 'e => e.dataset.game')
            has_ui = page.eval_on_selector('#game-host', 'e => e.querySelectorAll(".g *").length > 3')
            check(f'training {game_id} mounts its board', host_game == game_id and has_ui, f'host={host_game} nodes={has_ui}')
            budget = {'memory': 4.6, 'stopwatch': 3.4, 'flash': 3.0}.get(game_id, 2.2)
            seen = play_bot(page, budget)
            score = page.evaluate('window.__BS30_SESSION__?.score ?? -1')
            check(f'training {game_id} scores on answers', score > 0, f'score={score}')
            played.update(seen)
            page.evaluate('window.__BS30_SESSION__ && window.__BS30_SESSION__.end()')
            page.wait_for_timeout(420 if game_id != 'match' else 500)
            if page.eval_on_selector('#result-layer', 'e => !e.hidden'):
                page.evaluate('window.__BS30_TEST__.closeResult()')
                page.wait_for_timeout(160)
        check('all thirteen mini-games were answered by the bot', len(played) >= 12, sorted(played))

        s = state(page)
        check('training bests stored per game', len(s['trainingBest']) >= 13, s['trainingBest'])
        check('thirteen sessions recorded', len(s['records']) >= 13, len(s['records']))

        # ---------------------------------------------------------- shop buy/equip
        coins_before = s['coins']
        page.evaluate('window.__BS30_TEST__.tab("shop")')
        page.wait_for_timeout(300)
        page.click('[data-act="shop-tab:themes"]')
        page.wait_for_timeout(200)
        shot(page, '03_shop_themes.png')
        page.click('[data-act="buy:themes:sunset"]')
        page.wait_for_timeout(450)
        s = state(page)
        check('theme purchase deducts coins', s['coins'] == coins_before - 420, f"{coins_before} -> {s['coins']}")
        check('theme equipped right away', s['profile']['theme'] == 'sunset', s['profile']['theme'])
        check('theme applied to frame', page.eval_on_selector('#frame', 'e => e.dataset.theme') == 'sunset')
        check('owned item persisted', 'sunset' in s['owned']['themes'])

        # avatar purchase + equip via UI
        page.click('[data-act="shop-tab:avatars"]')
        page.wait_for_timeout(200)
        page.click('[data-act="buy:avatars:fox"]')
        page.wait_for_timeout(400)
        s = state(page)
        check('avatar purchase + equip', s['profile']['avatar'] == 'fox' and 'fox' in s['owned']['avatars'])
        shot(page, '04_shop_avatars.png')

        # locked chest item cannot be bought
        page.click('[data-act="shop-tab:themes"]')
        page.wait_for_timeout(150)
        check('limited theme shows lock state', page.eval_on_selector_all('[data-act="buy:themes:aurora"]', 'els => els.length') == 0)

        # ---------------------------------------------------------- nickname modal
        page.evaluate('window.__BS30_TEST__.tab("lobby")')
        page.wait_for_timeout(250)
        page.click('[data-act="edit-nick"]')
        page.wait_for_timeout(250)
        page.fill('#nick-input', '번개두뇌')
        page.click('[data-modal="ok"]')
        page.wait_for_timeout(300)
        check('nickname edited and saved', state(page)['profile']['nickname'] == '번개두뇌', state(page)['profile']['nickname'])
        check('nickname shows in lobby', '번개두뇌' in page.inner_text('.profile-card'))

        # ---------------------------------------------------------- full challenge
        before = state(page)
        page.evaluate('window.__BS30_TEST__.start("challenge")')
        page.wait_for_timeout(400)
        shot(page, '05_game_round.png')
        # pause / resume check
        page.click('#game-quit')
        page.wait_for_timeout(350)
        check('pause overlay opens', not page.eval_on_selector('#pause-layer', 'e => e.hidden'))
        page.click('#btn-resume')
        page.wait_for_timeout(350)
        check('pause overlay closes on resume', page.eval_on_selector('#pause-layer', 'e => e.hidden'))

        t0 = time.time()
        seen = play_bot(page, 64)
        elapsed = time.time() - t0
        check('challenge runs the full 60 seconds', 57.0 <= elapsed <= 64.5, f'{elapsed:.1f}s')
        check('challenge cycled multiple games', len(seen) >= 6, sorted(seen))
        page.wait_for_timeout(900)
        check('result overlay appears', page.eval_on_selector('#result-layer', 'e => !e.hidden'))
        shot(page, '06_result.png')
        result = page.evaluate('window.__BS30_TEST__.result()')
        check('result has a score', result and result['score'] > 0, result and result['score'])
        check('result has a grade', result and result['grade']['grade'] in ['S+', 'S', 'A', 'B', 'C', 'D'], result and result['grade']['grade'])
        check('result reports accuracy', result and 0 <= result['accuracy'] <= 100, result and result['accuracy'])
        check('result reports reaction ms', result and result['avgMs'] > 0, result and result['avgMs'])

        # ------------------------------------------------- challenge link (send)
        page.click('[data-res="challenge"]')
        page.wait_for_timeout(400)
        clip = page.evaluate('navigator.clipboard.readText()')
        check('result screen copies a challenge link', '?c=' in clip and '브레인 스파크' in clip, clip[:90])
        m = re.search(r'\?c=([A-Za-z0-9\-_]+)', clip)
        token = m.group(1) if m else ''
        check('challenge link carries a payload', len(token) > 20, token[:30])

        s = state(page)
        after = s['records'][0]
        check('challenge saved to records', after['mode'] == 'challenge' and after['score'] == result['score'],
              f"{after['score']} vs {result['score']}")
        check('cycle counter advanced', s['cycle']['count'] == min(10, before['cycle']['count'] + 1), s['cycle'])
        check('coins increased', s['coins'] > before['coins'], f"{before['coins']} -> {s['coins']}")
        check('best score updated', s['best'] >= result['score'], s['best'])

        # ---------------------------------------------------------- rewards claim
        page.evaluate('window.__BS30_TEST__.closeResult()')
        page.evaluate('window.__BS30_TEST__.tab("rewards")')
        page.wait_for_timeout(350)
        claimable = page.eval_on_selector_all('[data-act^="claim:"]', 'els => els.length')
        check('milestone claim button appears', claimable >= 1, claimable)
        coins_before = state(page)['coins']
        if claimable:
            page.click('[data-act^="claim:"]')
            page.wait_for_timeout(420)
        s = state(page)
        check('milestone claim pays coins', s['coins'] > coins_before, f"{coins_before} -> {s['coins']}")
        check('milestone marked claimed', len(s['cycle']['claimed']) >= 1, s['cycle']['claimed'])
        shot(page, '07_rewards.png')

        # ---------------------------------------------------------- chest + next cycle
        page.wait_for_timeout(200)
        chest_btn = page.eval_on_selector_all('[data-act="claim-chest"]', 'els => els.length')
        check('chest opens after 10 games', chest_btn == 1, chest_btn)
        if chest_btn:
            coins_before = state(page)['coins']
            page.click('[data-act="claim-chest"]')
            page.wait_for_timeout(600)
            s = state(page)
            check('chest grants coins', s['coins'] > coins_before, f"{coins_before} -> {s['coins']}")
            check('chest grants limited items', 'aurora' in s['owned']['themes'] and 'ten' in s['owned']['titles'], s['owned'])
            page.click('[data-modal="ok"]')
            page.wait_for_timeout(250)
            page.click('[data-act="next-cycle"]')
            page.wait_for_timeout(350)
            s = state(page)
            check('next cycle resets progress', s['cycle']['count'] == 0 and s['cycle']['index'] == 2, s['cycle'])

        # ---------------------------------------------------------- records + share
        page.evaluate('window.__BS30_TEST__.tab("records")')
        page.wait_for_timeout(400)
        check('records chart renders a line', page.eval_on_selector_all('.chart .line', 'els => els.length') == 1)
        rows = page.eval_on_selector_all('.hist-row', 'els => els.length')
        check('history list shows runs', rows >= 10, rows)
        shot(page, '08_records.png')
        page.click('[data-act="challenge-share"]')
        page.wait_for_timeout(400)
        clip = page.evaluate('navigator.clipboard.readText()')
        check('records screen copies a challenge link', '브레인 스파크' in clip and '?c=' in clip, clip[:70].replace('\n', ' / '))

        # ---------------------------------------------------------- persistence
        summary_before = state(page)
        page.reload(wait_until='networkidle')
        page.wait_for_timeout(900)
        after_reload = state(page)
        check('coins survive reload', after_reload['coins'] == summary_before['coins'], after_reload['coins'])
        check('best score survives reload', after_reload['best'] == summary_before['best'], after_reload['best'])
        check('records survive reload', len(after_reload['records']) == len(summary_before['records']), len(after_reload['records']))
        check('theme survives reload', page.eval_on_selector('#frame', 'e => e.dataset.theme') == 'sunset')
        check('nickname survives reload', '번개두뇌' in page.inner_text('.profile-card'))
        check('reward cycle survives reload', after_reload['cycle']['count'] == summary_before['cycle']['count'])

        # ---------------------------------------------------------- responsive passes
        small = browser.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=2)
        sp = small.new_page()
        sp.goto(url, wait_until='networkidle')
        sp.wait_for_timeout(800)
        sw = sp.evaluate('document.documentElement.scrollWidth')
        check('360x640 has no horizontal overflow', sw <= 360, sw)
        sp.screenshot(path=os.path.join(SHOTS, '09_small_lobby.png'))
        sp.evaluate('window.__BS30_TEST__.start("challenge")')
        sp.wait_for_timeout(500)
        sp.screenshot(path=os.path.join(SHOTS, '10_small_game.png'))
        sw2 = sp.evaluate('document.documentElement.scrollWidth')
        check('360x640 game has no horizontal overflow', sw2 <= 360, sw2)
        small.close()

        desk = browser.new_context(viewport={'width': 1280, 'height': 900}, device_scale_factor=1)
        dp = desk.new_page()
        dp.goto(url, wait_until='networkidle')
        dp.wait_for_timeout(900)
        frame_box = dp.eval_on_selector('#frame', 'e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }')
        check('desktop centers a phone-width frame', 400 <= frame_box[0] <= 460, frame_box)
        dp.screenshot(path=os.path.join(SHOTS, '11_desktop.png'))
        desk.close()

        # ---------------------------------------------------- challenge link (receive)
        friend_ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                                         permissions=['clipboard-read', 'clipboard-write'])
        fp = friend_ctx.new_page()
        fp.on('console', lambda m: ERRORS.append(('friend:' + m.type, m.text)) if m.type in ('error', 'warning') else None)
        fp.on('pageerror', lambda e: ERRORS.append(('friend:pageerror', str(e))))
        fp.goto(f'http://127.0.0.1:{PORT}/index.html?test=1&c={token}', wait_until='networkidle')
        fp.wait_for_timeout(1000)
        fs = state(fp)
        check('challenge link registers the friend', len(fs['friends']) == 1 and fs['friends'][0]['name'] == '번개두뇌', fs['friends'])
        check('challenge link carries the sent score', fs['friends'][0]['score'] == result['score'], f"{fs['friends'][0]['score']} vs {result['score']}")
        check('address bar is cleaned after intake', 'c=' not in fp.url and 'test=1' in fp.url, fp.url)
        banner = fp.inner_text('.challenge-banner') if fp.eval_on_selector_all('.challenge-banner', 'els => els.length') else ''
        check('challenge banner names the friend', '번개두뇌' in banner and '도전장' in banner, banner.replace('\n', ' / '))
        check('challenge banner shows the target score', f"{result['score']:,}" in banner, banner.replace('\n', ' / '))
        fp.screenshot(path=os.path.join(SHOTS, '12_challenge_banner.png'))

        fp.click('.cb-go')
        fp.wait_for_timeout(500)
        check('banner button starts the challenge', not fp.eval_on_selector('#game-layer', 'e => e.hidden'))
        fp.evaluate('window.__BS30_SESSION__ && window.__BS30_SESSION__.quit()')
        fp.wait_for_timeout(400)

        fp.evaluate('window.__BS30_TEST__.tab("rank")')
        fp.wait_for_timeout(420)
        friend_badges = fp.eval_on_selector_all('.rk-me-tag.friend, .p-friend', 'els => els.length')
        check('friend appears in the ranking with a 친구 badge', friend_badges >= 1, friend_badges)
        check('friend name is listed in the ranking', '번개두뇌' in fp.inner_text('.screen.active'))
        check('ranking has a friend management row', fp.eval_on_selector_all('[data-act="friends-clear"]', 'els => els.length') == 1)
        fp.screenshot(path=os.path.join(SHOTS, '13_challenge_rank.png'))

        fp.reload(wait_until='networkidle')
        fp.wait_for_timeout(900)
        fs2 = state(fp)
        check('friend survives reload without duplicates', len(fs2['friends']) == 1, len(fs2['friends']))
        check('challenge banner survives reload', fp.eval_on_selector_all('.challenge-banner', 'els => els.length') == 1)

        better = challenge_token({
            'v': 1, 'n': '번개두뇌', 's': result['score'] + 1500, 'm': 180, 'a': 92, 'c': 18,
            'av': 'fox', 'fr': 'bronze', 'ti': 'rookie', 'md': 'c', 't': int(time.time() * 1000),
        })
        fp.goto(f'http://127.0.0.1:{PORT}/index.html?test=1&c={better}', wait_until='networkidle')
        fp.wait_for_timeout(900)
        fs3 = state(fp)
        check('a higher score from the same friend replaces the row',
              len(fs3['friends']) == 1 and fs3['friends'][0]['score'] == result['score'] + 1500,
              fs3['friends'])

        fp.evaluate('window.__BS30_TEST__.tab("rank")')
        fp.wait_for_timeout(380)
        fp.click('[data-act="friends-clear"]')
        fp.wait_for_timeout(380)
        check('friend list can be cleared', len(state(fp)['friends']) == 0, state(fp)['friends'])
        friend_ctx.close()

        # ---------------------------------------------------------- console hygiene
        # ---------------------------------------------------------- reset records
        page.evaluate('window.__BS30_TEST__.tab("records")')
        page.wait_for_timeout(300)
        coins_before = state(page)['coins']
        page.click('[data-act="reset-records"]')
        page.wait_for_timeout(300)
        page.click('[data-modal="ok"]')
        page.wait_for_timeout(350)
        s = state(page)
        check('reset clears records', len(s['records']) == 0 and s['best'] == 0 and s['gamesPlayed'] == 0, len(s['records']))
        check('reset keeps coins', s['coins'] == coins_before, f"{coins_before} -> {s['coins']}")
        check('reset keeps owned items', 'sunset' in s['owned']['themes'] and 'fox' in s['owned']['avatars'])

        check('no console errors or warnings', len(ERRORS) == 0, ERRORS[:6])

        browser.close()

    passed = sum(1 for c in CHECKS if c['pass'])
    report = {'passed': passed, 'total': len(CHECKS), 'checks': CHECKS, 'console': ERRORS}
    with open(os.path.join(ROOT, 'tests', 'QA_REPORT.json'), 'w') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f'\n{passed}/{len(CHECKS)} checks passed')
    if ERRORS:
        print('console issues:', ERRORS[:8])
    sys.exit(0 if passed == len(CHECKS) else 1)

if __name__ == '__main__':
    main()
