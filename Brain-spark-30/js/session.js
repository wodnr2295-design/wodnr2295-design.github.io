// BRAIN SPARK 30 — 30-second session engine, scoring, combo and results
import { GAMES, GAME_BY_ID, GRADES, KIND_LABEL } from './data.js';
import { MINI_GAMES } from './games.js';
import { recordGame, getState, gradeFor } from './store.js';
import { sfx } from './audio.js';
import { burst, ripple, haptic } from './fx.js';

export const DURATION = 30000;
const COMBO_TABLE = [1.0, 1.25, 1.5, 1.75, 2.0, 2.3, 2.6, 3.0, 3.4, 3.7, 4.0];

export function comboMultiplier(combo) {
  return COMBO_TABLE[Math.min(COMBO_TABLE.length - 1, combo)] || 1;
}

const $ = (id) => document.getElementById(id);

export class Session {
  constructor({ mode = 'challenge', gameId = null, test = false }) {
    this.mode = mode;
    this.gameId = mode === 'training' ? gameId : null;
    this.test = test;
    this.time = 0;
    this.paused = false;
    this.running = false;
    this.round = null;
    this.roundIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.correct = 0;
    this.rounds = 0;
    this.reactSum = 0;
    this.reactN = 0;
    this.brainScore = 0;
    this.reactScore = 0;
    this.lastGameId = null;
    this.secondLast = null;
    this.timers = [];
    this.nextAt = null;
    this.results = [];
    this.lastBeep = -1;
    this.ended = false;
    this.onEnd = null;
    this.onQuit = null;
    this.raf = 0;
    this.lastTs = 0;
    this._bound = this.loop.bind(this);
  }

  /* ---------------------------------------------------------------- lifecycle */

  start(onEnd, onQuit) {
    this.onEnd = onEnd;
    this.onQuit = onQuit;
    this.running = true;
    this.time = 0;
    this.lastTs = performance.now();
    $('game-layer').hidden = false;
    $('game-layer').classList.add('live');
    this.updateHud();
    this.nextRound();
    this.raf = requestAnimationFrame(this._bound);
  }

  loop(ts) {
    if (!this.running) return;
    const dt = Math.min(60, ts - this.lastTs);
    this.lastTs = ts;
    if (!this.paused) {
      this.time += dt;
      this.fireTimers();
      this.tickRound();
      this.updateClock();
      if (this.nextAt != null && this.time >= this.nextAt) {
        this.nextAt = null;
        if (this.time < DURATION) this.nextRound();
      }
      if (this.time >= DURATION) {
        this.end();
        return;
      }
    }
    this.raf = requestAnimationFrame(this._bound);
  }

  fireTimers() {
    if (!this.timers.length) return;
    const due = [];
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].due <= this.time) {
        due.push(this.timers[i]);
        this.timers.splice(i, 1);
      }
    }
    due.sort((a, b) => a.due - b.due).forEach((t) => {
      if (this.ended) return;
      try { t.fn(); } catch (e) { console.warn('timer', e); }
    });
  }

  after(ms, fn) {
    this.timers.push({ due: this.time + ms, fn });
  }

  pause() {
    if (!this.running || this.ended) return;
    this.paused = true;
    this.lastTs = performance.now();
    $('pause-layer').hidden = false;
    requestAnimationFrame(() => $('pause-layer').classList.add('on'));
    this.sound('whoosh');
  }

  resume() {
    if (!this.running || this.ended) return;
    $('pause-layer').classList.remove('on');
    setTimeout(() => { $('pause-layer').hidden = true; }, 220);
    this.paused = false;
    this.lastTs = performance.now();
    this.sound('tick');
  }

  quit() {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.cleanupRound();
    $('pause-layer').hidden = true;
    $('pause-layer').classList.remove('on');
    $('game-layer').hidden = true;
    $('game-layer').classList.remove('live');
    if (this.onQuit) this.onQuit();
  }

  /* ------------------------------------------------------------------- rounds */

  pickGame() {
    if (this.mode === 'training') return GAME_BY_ID[this.gameId];
    if (this.roundIndex === 0) return GAME_BY_ID.signal || GAMES[0];
    const pool = GAMES.filter((g) => g.id !== this.lastGameId && g.id !== this.secondLast);
    return pool[(Math.random() * pool.length) | 0] || GAMES[0];
  }

  nextRound() {
    if (this.ended || this.time >= DURATION) return;
    this.cleanupRound();
    const game = this.pickGame();
    this.secondLast = this.lastGameId;
    this.lastGameId = game.id;

    const host = $('game-host');
    host.innerHTML = '';
    host.dataset.game = game.id;

    const banner = $('round-banner');
    banner.className = 'round-banner';
    banner.innerHTML = `
      <span class="rb-icon">${game.icon}</span>
      <span class="rb-text"><b>${game.name}</b><i>${KIND_LABEL[game.kind]}</i></span>
      <span class="rb-tag ${game.kind}">${game.kind === 'react' ? 'REACT' : 'BRAIN'}</span>`;
    requestAnimationFrame(() => banner.classList.add('show'));
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => banner.classList.remove('show'), 1350);
    document.querySelectorAll('.score-float').forEach((n) => n.remove());

    this.round = new Round(this, game);
    this.roundIndex += 1;
    this.round.mount();
    this.sound('whoosh');
  }

  cleanupRound() {
    if (this.round) {
      try { this.round.cleanup(); } catch (e) { /* noop */ }
      this.round = null;
    }
    this.timers = [];
  }

  tickRound() {
    const r = this.round;
    if (!r || r.resolved) return;
    if (r.startedAt != null && this.time - r.startedAt >= r.limit) {
      r.timeout();
    }
  }

  /* ------------------------------------------------------------------ answers */

  answer(kind, base, opts = {}) {
    const r = this.round;
    if (!r || r.resolved) return;
    r.resolved = true;
    r.cleanup();

    const elapsed = Math.max(0, Math.round(this.time - r.startedAt));
    const ms = opts.ms != null ? Math.round(opts.ms) : elapsed;

    if (kind === 'hit') {
      const mult = comboMultiplier(this.combo);
      const speedWindow = Math.min(r.limit, 3200);
      const speed = 1 + Math.max(0, Math.min(1, (speedWindow - ms) / speedWindow)) * (opts.perfect ? 0.4 : 0.28);
      const pts = Math.max(5, Math.round(base * mult * speed));
      this.score += pts;
      this.correct += 1;
      this.rounds += 1;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (r.game.kind === 'brain') this.brainScore += pts;
      else this.reactScore += pts;
      if (ms > 0) { this.reactSum += ms; this.reactN += 1; }

      this.results.push('hit');
      this.feedback('good', opts.label || '정답', pts, ms, true);
      this.sound(opts.perfect ? 'perfect' : 'correct', { pitch: 620 + Math.min(8, this.combo) * 28 });
      this.sound('combo', { level: Math.min(10, this.combo) });
      haptic(opts.perfect ? 'big' : 'correct');
      this.burstCenter(opts.perfect ? 'gold' : 'good');
      this.nextAt = this.time + 300;
    } else {
      this.rounds += 1;
      this.combo = 0;
      this.results.push('miss');
      this.feedback('bad', opts.label || '놓쳤어요', 0, ms, false);
      this.sound('wrong');
      haptic('wrong');
      this.shake();
      this.nextAt = this.time + 620;
    }
    this.updateHud();
    this.updatePips();
  }

  partial(points, opts = {}) {
    const r = this.round;
    if (!r || r.resolved) return;
    const mult = comboMultiplier(this.combo);
    const pts = Math.max(1, Math.round(points * mult));
    this.score += pts;
    if (r.game.kind === 'brain') this.brainScore += pts;
    else this.reactScore += pts;
    this.feedbackSmall(opts.label || '', pts, opts.at);
    this.sound('tap');
    this.updateHud();
  }

  /* ------------------------------------------------------------------- visuals */

  feedback(kind, label, pts, ms, good) {
    const stage = document.querySelector('.game-stage');
    const flash = $('round-flash');
    flash.className = 'round-flash ' + kind;
    void flash.offsetWidth;
    stage.classList.remove('shake');
    if (!good) { void stage.offsetWidth; stage.classList.add('shake'); }

    const pop = $('hud-pop');
    pop.innerHTML = good
      ? `<b>+${pts}</b><span>${label}</span>`
      : `<b>MISS</b><span>${label}</span>`;
    pop.className = 'hud-pop ' + (good ? 'good' : 'bad');
    void pop.offsetWidth;
    pop.classList.add('pop');

    if (good) {
      const rect = $('game-host').getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      ripple(rect.left - stageRect.left + rect.width / 2, rect.top - stageRect.top + rect.height * 0.45, 'rgba(120,255,210,0.6)');
    }
  }

  feedbackSmall(label, pts, at) {
    const host = $('game-host');
    const stage = document.querySelector('.game-stage');
    const rect = host.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const x = at ? at.x - stageRect.left : rect.left - stageRect.left + rect.width / 2;
    const y = at ? at.y - stageRect.top : rect.top - stageRect.top + rect.height * 0.5;
    const f = document.createElement('div');
    f.className = 'score-float mini good';
    f.innerHTML = `<b>+${pts}</b>`;
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    stage.append(f);
    setTimeout(() => f.remove(), 650);
  }

  burstCenter(kind) {
    const stage = document.querySelector('.game-stage');
    const rect = stage.getBoundingClientRect();
    const colors = kind === 'gold'
      ? ['#FFD76B', '#FFC24B', '#FFFFFF', '#FF8A4C']
      : ['#5CFFC8', '#37D9FF', '#FFFFFF'];
    burst(rect.width / 2, rect.height * 0.45, { count: kind === 'gold' ? 22 : 12, power: kind === 'gold' ? 1.5 : 1, colors, lift: 0.4 });
  }

  shake() {
    const stage = document.querySelector('.game-stage');
    stage.classList.remove('shake');
    void stage.offsetWidth;
    stage.classList.add('shake');
    setTimeout(() => stage.classList.remove('shake'), 400);
  }

  sound(name, opts) {
    sfx(name, opts);
  }

  /* ----------------------------------------------------------------- HUD/core */

  updateHud() {
    $('hud-score').textContent = this.score.toLocaleString('ko-KR');
    const mult = comboMultiplier(this.combo);
    $('combo-mult').textContent = 'x' + mult.toFixed(2).replace(/0$/, '');
    $('combo-count').textContent = '콤보 ' + this.combo;
    const pill = $('hud-combo');
    pill.dataset.level = String(Math.min(4, Math.floor(this.combo / 3)));
    pill.classList.remove('bump');
    void pill.offsetWidth;
    if (this.combo > 0) pill.classList.add('bump');
  }

  updateClock() {
    const remain = Math.max(0, DURATION - this.time);
    const fill = $('timer-fill');
    fill.style.transform = `scaleX(${remain / DURATION})`;
    const secs = remain / 1000;
    $('game-time').textContent = secs.toFixed(1);
    const layer = $('game-layer');
    layer.classList.toggle('urgent', secs <= 5.5);
    const whole = Math.ceil(secs);
    if (secs <= 5.05 && whole !== this.lastBeep) {
      this.lastBeep = whole;
      this.sound(whole <= 3 ? 'tock' : 'tick');
    }
  }

  updatePips() {
    const wrap = $('round-pips');
    wrap.innerHTML = this.results.slice(-14).map((r) => `<i class="${r}"></i>`).join('');
  }

  /* -------------------------------------------------------------------- result */

  end() {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.cleanupRound();
    this.sound('end');

    const accuracy = this.rounds ? (this.correct / this.rounds) * 100 : 0;
    const avgMs = this.reactN ? Math.round(this.reactSum / this.reactN) : 0;
    const grade = gradeFor(this.score);
    let coins = Math.max(3, Math.round(this.score / 45));
    if (accuracy >= 85 && this.rounds >= 4) coins += 15;
    coins += Math.min(40, Math.round(this.maxCombo * 1.2));

    const result = {
      mode: this.mode,
      gameId: this.gameId,
      score: this.score,
      grade,
      accuracy: Math.round(accuracy),
      avgMs,
      maxCombo: this.maxCombo,
      rounds: this.rounds,
      correct: this.correct,
      coins,
      brainScore: this.brainScore,
      reactScore: this.reactScore,
      duration: DURATION,
      playedAt: new Date().toISOString(),
    };
    const summary = recordGame(result);
    result.best = summary.best;
    result.newBest = summary.newBest;
    result.prevBest = summary.prevBest;
    result.milestone = summary.milestone;
    result.chestReady = summary.chestReady;
    result.totalCoins = summary.coins;

    $('game-layer').hidden = true;
    $('game-layer').classList.remove('live');
    if (this.onEnd) this.onEnd(result);
  }
}

/* ---------------------------------------------------------------------- Round */

class Round {
  constructor(session, game) {
    this.session = session;
    this.game = game;
    this.resolved = false;
    this.startedAt = null;
    this.limit = game.limit || 3200;
    if (session.mode === 'training') this.limit = Math.round(this.limit * 1.08);
    this.ctx = null;
  }

  mount() {
    const s = this.session;
    const g = this.game;
    this.startedAt = s.time;
    const host = $('game-host');

    const ctx = {
      host,
      game: g,
      index: s.roundIndex,
      difficulty: Math.min(2.2, s.roundIndex / 9 + (s.mode === 'training' ? 0.25 : 0)),
      limit: this.limit,
      isTest: s.test,
      ms: () => Math.round(s.time - this.startedAt),
      hit: (points, opts) => s.answer('hit', points, opts),
      done: (points, opts) => s.answer('hit', points, opts),
      miss: (opts) => s.answer('miss', 0, opts || {}),
      partial: (points, opts) => s.partial(points, opts),
      sound: (n, o) => s.sound(n, o),
      timeout: (fn, ms) => s.after(ms, fn),
      setLimit: (ms) => { this.limit = ms; },
      burstAt: (x, y, kind) => {
        const colors = kind === 'gold' ? ['#FFD76B', '#FFFFFF', '#FF8A4C'] : ['#5CFFC8', '#37D9FF'];
        burst(x, y, { count: 16, power: 1.2, colors, lift: 0.3 });
        ripple(x, y, 'rgba(255,214,107,0.8)');
      },
      flash: () => {},
    };
    this.ctx = ctx;
    try {
      this.cleanupFn = MINI_GAMES[g.id].start(ctx) || (() => {});
    } catch (e) {
      console.warn('game start failed', g.id, e);
      this.cleanupFn = () => {};
    }
  }

  timeout() {
    if (this.resolved) return;
    this.cleanup();
    this.session.answer('miss', 0, { label: '시간 초과' });
  }

  cleanup() {
    if (this.cleanupFn) {
      try { this.cleanupFn(); } catch (e) { /* noop */ }
      this.cleanupFn = null;
    }
  }
}
