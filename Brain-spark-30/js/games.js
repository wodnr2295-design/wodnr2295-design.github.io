// BRAIN SPARK 30 — nine mini-games.
// Each game exposes start(ctx) and returns a cleanup function.
// ctx.hit / ctx.miss end the round; ctx.partial scores a step and keeps it going.

const h = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ 1. 신호등 */

const signal = {
  start(ctx) {
    const wrap = h('div', 'g g-signal');
    const orb = h('button', 'sg-light', `
      <span class="sg-lamp red on"></span>
      <span class="sg-lamp amber"></span>
      <span class="sg-lamp green"></span>
      <span class="sg-label">준비</span>`);
    orb.type = 'button';
    orb.dataset.state = 'wait';
    orb.setAttribute('aria-label', '신호등');
    const hint = h('div', 'g-hint', '<b>초록불</b>에만 탭 · <b class="purple">보라색</b>은 훼이크');
    wrap.append(orb, hint);
    ctx.host.append(wrap);

    let phase = 'wait';
    let greenAt = 0;
    let resolved = false;
    const T = (fn, ms) => ctx.timeout(fn, ms);

    const setOrb = (state, label) => {
      orb.dataset.state = state;
      orb.querySelector('.sg-label').textContent = label;
      const red = orb.querySelector('.red');
      const amber = orb.querySelector('.amber');
      const greenL = orb.querySelector('.green');
      red.classList.toggle('on', state === 'wait');
      amber.classList.toggle('fake', state === 'fake');
      greenL.classList.toggle('on', state === 'green');
    };

    const green = () => {
      if (resolved) return;
      phase = 'green';
      greenAt = performance.now();
      setOrb('green', '탭!');
      if (ctx.isTest) { orb.dataset.ok = '1'; }
      ctx.sound('tick');
      T(() => {
        if (!resolved && phase === 'green') { resolved = true; ctx.miss({ label: '신호를 놓쳤어요' }); }
      }, ri(1000, 1400));
    };

    // decoy: a purple "탭?" that must be ignored
    const first = ri(700, 1900);
    if (first > 1200 && Math.random() < 0.75) {
      T(() => {
        if (resolved) return;
        phase = 'fake';
        setOrb('fake', '지금?');
        ctx.sound('tock');
        T(() => { if (!resolved) { phase = 'wait'; setOrb('wait', '대기'); } }, 380);
      }, ri(320, first - 420));
      T(green, first + 380);
    } else {
      T(green, first);
    }

    orb.addEventListener('click', () => {
      if (resolved) return;
      if (phase === 'green') {
        resolved = true;
        const ms = Math.round(performance.now() - greenAt);
        ctx.hit(90 + Math.max(0, 220 - ms) * 0.55, { ms, label: ms + 'ms', perfect: ms < 260 });
      } else if (phase === 'fake') {
        resolved = true;
        orb.classList.add('boom');
        ctx.miss({ label: '훼이크에 낚였어요' });
      } else {
        resolved = true;
        orb.classList.add('boom');
        ctx.miss({ label: '아직 빨간불!' });
      }
    });

    return () => {};
  },
};

/* --------------------------------------------------------------- 2. 스나이퍼 */

const sniper = {
  start(ctx) {
    const wrap = h('div', 'g g-sniper');
    const field = h('div', 'sn-field');
    const hint = h('div', 'g-hint', '황금 타겟만 · <b class="danger">폭탄</b> 금지');
    wrap.append(field, hint);
    ctx.host.append(wrap);

    const slots = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
    const bombCount = ctx.difficulty > 0.6 ? (ctx.difficulty > 1.3 ? 3 : 2) : 1;
    const goldSlot = slots[0];
    const bombSlots = slots.slice(1, 1 + bombCount);
    let resolved = false;

    slots.forEach((slot, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const isGold = slot === goldSlot;
      const isBomb = bombSlots.includes(slot);
      if (!isGold && !isBomb) {
        const dot = h('span', 'sn-empty', '');
        dot.style.gridArea = `${row + 1} / ${col + 1}`;
        dot.style.transform = `translate(${ri(-8, 8)}px, ${ri(-8, 8)}px)`;
        field.append(dot);
        return;
      }
      const b = h('button', 'sn-target ' + (isGold ? 'gold' : 'bomb'));
      b.type = 'button';
      b.style.gridArea = `${row + 1} / ${col + 1}`;
      b.style.transform = `translate(${ri(-6, 6)}px, ${ri(-6, 6)}px)`;
      b.innerHTML = isGold
        ? '<span class="sn-ring"></span><span class="sn-core">★</span>'
        : '<span class="sn-ring"></span><span class="sn-core">✖</span>';
      b.setAttribute('aria-label', isGold ? '황금 타겟' : '폭탄');
      if (isGold && ctx.isTest) b.dataset.ok = '1';
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (resolved) return;
        if (isGold) {
          resolved = true;
          const r = field.getBoundingClientRect();
          ctx.burstAt(ev.clientX - r.left, ev.clientY - r.top, 'gold');
          ctx.hit(110, { ms: ctx.ms(), label: '명중!', perfect: true });
        } else {
          resolved = true;
          b.classList.add('boom');
          ctx.miss({ label: '폭탄을 건드렸어요' });
        }
      });
      field.append(b);
    });

    return () => {};
  },
};

/* ------------------------------------------------------------ 3. 1→9 순서 터치 */

const order = {
  start(ctx) {
    const wrap = h('div', 'g g-order');
    const nextChip = h('div', 'od-next', '<span>다음 숫자</span><b>1</b>');
    const grid = h('div', 'od-grid');
    const hint = h('div', 'g-hint', '<b>1 → 9</b> 순서대로 빠르게');
    wrap.append(nextChip, grid, hint);
    ctx.host.append(wrap);

    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let next = 1;
    let resolved = false;
    const buttons = [];

    nums.forEach((n) => {
      const b = h('button', 'od-cell', String(n));
      b.type = 'button';
      if (ctx.isTest) { b.dataset.ok = '1'; b.dataset.step = String(n); }
      b.dataset.n = String(n);
      b.addEventListener('click', (ev) => {
        if (resolved) return;
        if (n === next) {
          b.classList.add('done');
          b.disabled = true;
          ctx.partial(38, { label: String(n), at: { x: ev.clientX, y: ev.clientY } });
          next += 1;
          nextChip.querySelector('b').textContent = next > 9 ? '완료' : String(next);
          if (next > 9) {
            resolved = true;
            ctx.hit(120, { ms: ctx.ms(), label: '완주!', perfect: ctx.ms() < 3400 });
          }
        } else {
          resolved = true;
          b.classList.add('bad');
          grid.querySelectorAll('.od-cell').forEach((c) => {
            if (Number(c.dataset.n) === next) c.classList.add('reveal');
          });
          ctx.miss({ label: `다음은 ${next}였어요` });
        }
      });
      buttons.push(b);
      grid.append(b);
    });

    return () => {};
  },
};

/* --------------------------------------------------------------- 4. 방향 러시 */

const DIRS = [
  { id: 'up', glyph: '↑', cls: 'up' },
  { id: 'right', glyph: '→', cls: 'right' },
  { id: 'down', glyph: '↓', cls: 'down' },
  { id: 'left', glyph: '←', cls: 'left' },
];
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

const direction = {
  start(ctx) {
    const wrap = h('div', 'g g-dir');
    const inverse = ctx.index > 0 && Math.random() < 0.55;
    const shown = pick(DIRS);
    const rule = h('div', 'dir-rule' + (inverse ? ' inverse' : ''), inverse ? '반대 방향!' : '같은 방향');
    const arrow = h('div', 'dir-arrow ' + shown.cls, shown.glyph);
    const pad = h('div', 'dir-pad');
    wrap.append(rule, arrow, pad);
    ctx.host.append(wrap);

    const wanted = inverse ? OPP[shown.id] : shown.id;
    let resolved = false;

    const layout = [
      ['', 'up', ''],
      ['left', '', 'right'],
      ['', 'down', ''],
    ];
    layout.forEach((row) => row.forEach((id) => {
      if (!id) { pad.append(h('span', 'dir-hole')); return; }
      const d = DIRS.find((x) => x.id === id);
      const b = h('button', 'dir-key ' + d.cls, d.glyph);
      b.type = 'button';
      b.setAttribute('aria-label', d.id);
      if (id === wanted && ctx.isTest) b.dataset.ok = '1';
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (resolved) return;
        if (id === wanted) {
          resolved = true;
          ctx.hit(100 + (inverse ? 30 : 0), { ms: ctx.ms(), label: '정확!', perfect: ctx.ms() < 900 });
        } else {
          resolved = true;
          ctx.miss({ label: inverse ? '반대 방향이었어요' : '방향이 달랐어요' });
        }
      });
      pad.append(b);
    }));

    return () => {};
  },
};

/* --------------------------------------------------------- 5. 스트룹 컬러 트랩 */

const COLORS = [
  { id: 'red', name: '빨강', hex: '#FF5C6C' },
  { id: 'blue', name: '파랑', hex: '#4C8DFF' },
  { id: 'green', name: '초록', hex: '#2FE08A' },
  { id: 'yellow', name: '노랑', hex: '#FFC24B' },
];

const stroop = {
  start(ctx) {
    const wrap = h('div', 'g g-stroop');
    const askInk = Math.random() < 0.5;
    const word = pick(COLORS);
    let ink = pick(COLORS);
    while (ink.id === word.id) ink = pick(COLORS);

    const rule = h('div', 'stroop-rule', askInk ? '글자 <b>색</b>을 고르세요' : '글자 <b>뜻</b>을 고르세요');
    const big = h('div', 'stroop-word', word.name);
    big.style.color = ink.hex;
    big.style.textShadow = `0 0 26px ${ink.hex}66`;
    const opts = h('div', 'stroop-opts');
    wrap.append(rule, big, opts);
    ctx.host.append(wrap);

    const answer = askInk ? ink.id : word.id;
    const shuffled = shuffle(COLORS);
    let resolved = false;

    shuffled.forEach((c) => {
      const b = h('button', 'stroop-opt');
      b.type = 'button';
      b.innerHTML = `<span class="dot" style="background:${c.hex};box-shadow:0 0 16px ${c.hex}66"></span><span>${c.name}</span>`;
      b.setAttribute('aria-label', c.name);
      if (c.id === answer && ctx.isTest) b.dataset.ok = '1';
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (resolved) return;
        resolved = true;
        const ms = ctx.ms();
        if (c.id === answer) ctx.hit(105, { ms, label: `${c.name} 정답`, perfect: ms < 800 });
        else ctx.miss({ label: `정답은 ${COLORS.find((x) => x.id === answer).name}` });
      });
      opts.append(b);
    });

    return () => {};
  },
};

/* ---------------------------------------------------------------- 6. 번개 암산 */

const math = {
  start(ctx) {
    const d = ctx.difficulty;
    const type = Math.random() < (d > 0.9 ? 0.35 : 0.18) ? 'compare' : pick(['add', 'add', 'sub', 'mul']);
    let q;
    let answer;
    let options;

    if (type === 'add') {
      const lo = d < 0.5 ? 12 : d < 1.2 ? 24 : 48;
      const hi = d < 0.5 ? 48 : d < 1.2 ? 89 : 168;
      const a = ri(lo, hi);
      const b = ri(lo, hi);
      q = `${a} + ${b}`;
      answer = a + b;
      const set = new Set([answer]);
      while (set.size < 4) {
        const off = ri(1, Math.max(3, Math.round(hi / 12))) * pick([-1, 1]);
        const v = answer + off;
        if (v > 0) set.add(v);
      }
      options = shuffle([...set]).map(String);
    } else if (type === 'sub') {
      const lo = d < 0.5 ? 20 : 40;
      const hi = d < 0.5 ? 60 : 120;
      const a = ri(lo, hi);
      const b = ri(5, a - 2);
      q = `${a} − ${b}`;
      answer = a - b;
      const set = new Set([answer]);
      while (set.size < 4) {
        const v = answer + ri(-9, 9);
        if (v > 0 && v !== answer) set.add(v);
      }
      options = shuffle([...set]).map(String);
    } else if (type === 'mul') {
      const a = ri(2, d < 0.6 ? 6 : 9);
      const b = ri(2, d < 0.6 ? 9 : 12);
      q = `${a} × ${b}`;
      answer = a * b;
      const set = new Set([answer]);
      while (set.size < 4) {
        const v = a * (b + pick([-2, -1, 1, 2]));
        if (v > 0 && v !== answer) set.add(v);
      }
      options = shuffle([...set]).map(String);
    } else {
      const a = ri(20, 98);
      let b = ri(20, 98);
      while (b === a) b = ri(20, 98);
      q = `${a} ? ${b}`;
      answer = a > b ? '>' : a < b ? '<' : '=';
      options = ['<', '=', '>'];
    }

    const wrap = h('div', 'g g-math');
    const qEl = h('div', 'math-q', q.replace(/([+\-−×?])/, '<span class="eq">$1</span>'));
    const opts = h('div', 'math-opts' + (type === 'compare' ? ' cmp' : ''));
    const hint = h('div', 'g-hint', type === 'compare' ? '크기를 비교하세요' : '정답을 고르세요');
    wrap.append(qEl, opts, hint);
    ctx.host.append(wrap);

    let resolved = false;
    shuffle(options).forEach((o) => {
      const b = h('button', 'math-opt', String(o));
      b.type = 'button';
      if (String(o) === String(answer) && ctx.isTest) b.dataset.ok = '1';
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (resolved) return;
        resolved = true;
        const ms = ctx.ms();
        if (String(o) === String(answer)) ctx.hit(type === 'compare' ? 95 : 115, { ms, label: '정답!', perfect: ms < 1200 });
        else ctx.miss({ label: `정답은 ${answer}` });
      });
      opts.append(b);
    });

    return () => {};
  },
};

/* ------------------------------------------------------------ 7. 순간 기억력 */

const memory = {
  start(ctx) {
    const d = ctx.difficulty;
    const size = d > 1.35 ? 4 : 3;
    const cells = size * size;
    const seqLen = d < 0.45 ? 3 : d < 1.1 ? 4 : 5;
    const seq = shuffle([...Array(cells).keys()]).slice(0, seqLen);

    const wrap = h('div', 'g g-mem');
    const grid = h('div', 'mem-grid' + (size === 4 ? ' big' : ''));
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    const phase = h('div', 'mem-phase', `<b>${seqLen}개</b> 기억하세요`);
    const hint = h('div', 'g-hint', '잘 보세요…');
    wrap.append(phase, grid, hint);
    ctx.host.append(wrap);

    const els = [];
    for (let i = 0; i < cells; i++) {
      const c = h('button', 'mem-cell', '<span></span>');
      c.type = 'button';
      c.disabled = true;
      if (ctx.isTest && seq.includes(i)) { c.dataset.ok = '1'; c.dataset.step = String(seq.indexOf(i) + 1); }
      els.push(c);
      grid.append(c);
    }

    let answerIndex = 0;
    let resolved = false;
    let accepting = false;
    const flashMs = 400;
    const gapMs = 130;

    seq.forEach((cellIdx, i) => {
      ctx.timeout(() => {
        els[cellIdx].classList.add('lit');
        ctx.sound('tick');
        ctx.timeout(() => els[cellIdx].classList.remove('lit'), flashMs - 40);
      }, 380 + i * (flashMs + gapMs));
    });

    ctx.timeout(() => {
      accepting = true;
      phase.innerHTML = '<b>이제</b> 순서대로 탭!';
      phase.classList.add('go');
      hint.innerHTML = '틀리면 라운드 종료';
      els.forEach((c) => { c.disabled = false; });
    }, 380 + seqLen * (flashMs + gapMs) - 40);

    els.forEach((c, i) => {
      c.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (!accepting || resolved) return;
        if (seq[answerIndex] === i) {
          c.classList.add('ok');
          c.disabled = true;
          ctx.partial(46, { label: '기억', at: { x: ev.clientX, y: ev.clientY } });
          answerIndex += 1;
          if (answerIndex >= seq.length) {
            resolved = true;
            ctx.hit(120, { ms: ctx.ms(), label: `${seq.length}개 완벽!`, perfect: true });
          }
        } else {
          resolved = true;
          c.classList.add('bad');
          els[seq[answerIndex]].classList.add('reveal');
          ctx.miss({ label: '순서가 달라요' });
        }
      });
    });

    ctx.setLimit(380 + seqLen * (flashMs + gapMs) + 3600);
    return () => {};
  },
};

/* ------------------------------------------------------------ 8. 다른 하나 찾기 */

const ODD_PAIRS = [
  ['◆', '◇'], ['●', '◉'], ['▲', '△'], ['■', '□'], ['✦', '✧'], ['⬢', '⬡'], ['◐', '◑'], ['✚', '✛'],
];
const ROT_GLYPHS = ['◆', '▲', '■', '✚', '✦', '⬢'];

const odd = {
  start(ctx) {
    const d = ctx.difficulty;
    const cols = d > 1.3 ? 4 : d > 0.55 ? 3 : 3;
    const count = d > 1.3 ? 12 : d > 0.55 ? 9 : 6;
    const useRotation = Math.random() < 0.55;
    const base = useRotation ? pick(ROT_GLYPHS) : null;
    const pair = pick(ODD_PAIRS);
    const oddIndex = ri(0, count - 1);
    const rot = ri(20, 34) * pick([-1, 1]);

    const wrap = h('div', 'g g-odd');
    const grid = h('div', 'odd-grid');
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const hint = h('div', 'g-hint', '하나만 다릅니다');
    wrap.append(grid, hint);
    ctx.host.append(wrap);

    let resolved = false;
    for (let i = 0; i < count; i++) {
      const isOdd = i === oddIndex;
      let glyph = pair[0];
      let style = '';
      if (useRotation) {
        glyph = base;
        style = isOdd ? `transform: rotate(${rot}deg)` : '';
      } else {
        glyph = isOdd ? pair[1] : pair[0];
      }
      const b = h('button', 'odd-cell', `<span style="${style}">${glyph}</span>`);
      b.type = 'button';
      if (isOdd && ctx.isTest) b.dataset.ok = '1';
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (resolved) return;
        resolved = true;
        const ms = ctx.ms();
        if (isOdd) ctx.hit(115, { ms, label: '발견!', perfect: ms < 2200 });
        else {
          b.classList.add('bad');
          grid.children[oddIndex].classList.add('reveal');
          ctx.miss({ label: '다른 기호를 놓쳤어요' });
        }
      });
      grid.append(b);
    }

    return () => {};
  },
};

/* ------------------------------------------------------------- 9. 도형 매칭 */

const SYMBOLS = ['◆', '●', '▲', '■', '✦', '✚'];
const match = {
  start(ctx) {
    const target = [...Array(3)].map(() => pick(SYMBOLS));
    // ensure not all identical (looks like a mistake)
    if (target.every((s) => s === target[0])) target[1] = pick(SYMBOLS.filter((s) => s !== target[0]));

    const wrap = h('div', 'g g-match');
    const targetEl = h('div', 'mt-target');
    target.forEach((sym, i) => {
      const chip = h('span', 'mt-chip', sym);
      chip.style.setProperty('--d', `${i * 60}ms`);
      targetEl.append(chip);
    });
    const opts = h('div', 'mt-opts');
    const hint = h('div', 'g-hint', '같은 조합을 고르세요');
    wrap.append(targetEl, opts, hint);
    ctx.host.append(wrap);

    const variants = [];
    variants.push(target.slice());
    while (variants.length < 4) {
      const v = target.slice();
      const mode = Math.random();
      if (mode < 0.5) {
        const at = ri(0, 2);
        v[at] = pick(SYMBOLS.filter((s) => s !== v[at]));
      } else {
        const a = ri(0, 2);
        let b = ri(0, 2);
        while (b === a) b = ri(0, 2);
        [v[a], v[b]] = [v[b], v[a]];
      }
      if (!variants.some((x) => x.join('') === v.join(''))) variants.push(v);
    }

    let resolved = false;
    shuffle(variants).forEach((v) => {
      const b = h('button', 'mt-opt');
      b.type = 'button';
      v.forEach((sym) => b.append(h('span', 'mt-chip sm', sym)));
      const isRight = v.join('') === target.join('');
      if (isRight && ctx.isTest) b.dataset.ok = '1';
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (resolved) return;
        resolved = true;
        const ms = ctx.ms();
        if (isRight) ctx.hit(105, { ms, label: '일치!', perfect: ms < 1400 });
        else ctx.miss({ label: '조합이 달라요' });
      });
      opts.append(b);
    });

    return () => {};
  },
};

export const MINI_GAMES = { signal, sniper, order, direction, stroop, math, memory, odd, match };
