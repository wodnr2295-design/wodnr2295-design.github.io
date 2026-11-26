// BRAIN SPARK 30 — tiny Web Audio engine (SFX + ambient BGM, no assets)
let ac = null;
let master = null;
let sfxBus = null;
let bgmBus = null;
let bgmTimer = null;
let bgmStep = 0;
let bgmOn = true;
let sfxOn = true;

function ensure() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(ac.destination);

  sfxBus = ac.createGain();
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);

  bgmBus = ac.createGain();
  bgmBus.gain.value = 0;
  bgmBus.connect(master);
  return ac;
}

export function unlockAudio() {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  if (bgmOn && !bgmTimer) startBgm();
}

export function setSfxEnabled(on) {
  sfxOn = !!on;
  if (sfxBus) sfxBus.gain.value = on ? 0.9 : 0;
}

export function setBgmEnabled(on) {
  bgmOn = !!on;
  if (!on) {
    stopBgm();
    return;
  }
  if (ac) {
    bgmBus.gain.cancelScheduledValues(ac.currentTime);
    bgmBus.gain.setTargetAtTime(0.5, ac.currentTime, 0.3);
    if (!bgmTimer) startBgm();
  }
}

function note(freq, { t = 0, dur = 0.15, type = 'sine', gain = 0.06, slide = 0, dest = null, attack = 0.006 } = {}) {
  const c = ensure();
  if (!c) return;
  const start = c.currentTime + t;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(dest || sfxBus);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

function noise({ t = 0, dur = 0.12, gain = 0.05, hp = 800 } = {}) {
  const c = ensure();
  if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(c.currentTime + t);
}

const BGM_CHORDS = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
  [164.81, 207.65, 246.94], // E
];
const BGM_ARP = [0, 2, 1, 2, 0, 1, 2, 1];

export function startBgm() {
  const c = ensure();
  if (!c) return;
  if (!bgmOn) return;
  bgmBus.gain.cancelScheduledValues(c.currentTime);
  bgmBus.gain.setValueAtTime(Math.max(0.0001, bgmBus.gain.value), c.currentTime);
  bgmBus.gain.setTargetAtTime(0.5, c.currentTime, 0.5);
  if (bgmTimer) return;
  bgmStep = 0;
  const beat = 0.42;
  let next = c.currentTime + 0.1;
  bgmTimer = setInterval(() => {
    if (!ac) return;
    while (next < ac.currentTime + 0.8) {
      const bar = Math.floor(bgmStep / 8) % BGM_CHORDS.length;
      const chord = BGM_CHORDS[bar];
      const idx = bgmStep % 8;
      // pad on the first beat of the bar
      if (idx === 0) {
        chord.forEach((f, i) => {
          note(f / 2, { t: next - ac.currentTime, dur: beat * 7.4, type: 'triangle', gain: 0.022, dest: bgmBus, attack: 0.5 });
          note(f, { t: next - ac.currentTime, dur: beat * 7.4, type: 'sine', gain: 0.010 + i * 0.002, dest: bgmBus, attack: 0.7 });
        });
      }
      // pluck arpeggio
      const f = chord[BGM_ARP[idx]] * 2;
      note(f, { t: next - ac.currentTime, dur: 0.22, type: 'triangle', gain: 0.020, dest: bgmBus });
      if (idx === 4) note(f * 1.5, { t: next - ac.currentTime + 0.02, dur: 0.16, type: 'sine', gain: 0.010, dest: bgmBus });
      next += beat;
      bgmStep++;
    }
  }, 200);
}

export function stopBgm() {
  if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  if (bgmBus && ac) {
    bgmBus.gain.cancelScheduledValues(ac.currentTime);
    bgmBus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25);
  }
}

export function sfx(name, opt = {}) {
  if (!sfxOn) return;
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  switch (name) {
    case 'tap':
      note(520, { dur: 0.06, type: 'square', gain: 0.028 });
      note(780, { t: 0.01, dur: 0.05, type: 'sine', gain: 0.02 });
      break;
    case 'correct': {
      const base = opt.pitch || 660;
      note(base, { dur: 0.11, type: 'triangle', gain: 0.06 });
      note(base * 1.335, { t: 0.06, dur: 0.13, type: 'triangle', gain: 0.05 });
      note(base * 2, { t: 0.12, dur: 0.16, type: 'sine', gain: 0.035 });
      break;
    }
    case 'perfect':
      [880, 1108, 1320, 1760].forEach((f, i) => note(f, { t: i * 0.055, dur: 0.18, type: 'triangle', gain: 0.05 }));
      noise({ dur: 0.16, gain: 0.02, hp: 4000 });
      break;
    case 'wrong':
      note(220, { dur: 0.16, type: 'sawtooth', gain: 0.05, slide: 110 });
      note(164, { t: 0.04, dur: 0.2, type: 'square', gain: 0.025, slide: 90 });
      break;
    case 'combo': {
      const lvl = Math.min(8, opt.level || 1);
      const f = 520 * Math.pow(1.09, lvl);
      note(f, { dur: 0.09, type: 'sine', gain: 0.05 });
      note(f * 1.5, { t: 0.05, dur: 0.12, type: 'triangle', gain: 0.035 });
      break;
    }
    case 'tick':
      note(1400, { dur: 0.035, type: 'square', gain: 0.02 });
      break;
    case 'tock':
      note(900, { dur: 0.05, type: 'square', gain: 0.025 });
      break;
    case 'start':
      note(330, { dur: 0.22, type: 'sawtooth', gain: 0.045, slide: 990 });
      note(495, { t: 0.1, dur: 0.26, type: 'triangle', gain: 0.04, slide: 1320 });
      break;
    case 'end':
      [660, 550, 440].forEach((f, i) => note(f, { t: i * 0.1, dur: 0.3, type: 'triangle', gain: 0.05 }));
      break;
    case 'buy':
      note(1320, { dur: 0.08, type: 'triangle', gain: 0.045 });
      note(1760, { t: 0.07, dur: 0.12, type: 'triangle', gain: 0.04 });
      note(2093, { t: 0.14, dur: 0.18, type: 'sine', gain: 0.032 });
      break;
    case 'equip':
      note(760, { dur: 0.06, type: 'square', gain: 0.03 });
      note(1140, { t: 0.05, dur: 0.09, type: 'sine', gain: 0.028 });
      break;
    case 'chest':
      [523, 659, 784, 1046, 1318].forEach((f, i) => note(f, { t: i * 0.075, dur: 0.3, type: 'triangle', gain: 0.05 }));
      noise({ t: 0.3, dur: 0.4, gain: 0.02, hp: 3000 });
      break;
    case 'claim':
      note(880, { dur: 0.1, type: 'triangle', gain: 0.05 });
      note(1174, { t: 0.08, dur: 0.14, type: 'triangle', gain: 0.045 });
      break;
    case 'whoosh':
      noise({ dur: 0.22, gain: 0.03, hp: 1200 });
      break;
    case 'record':
      [784, 988, 1174, 1568].forEach((f, i) => note(f, { t: i * 0.08, dur: 0.3, type: 'sine', gain: 0.045 }));
      break;
    default:
      break;
  }
}

export function audioState() {
  return { ready: !!ac, state: ac ? ac.state : 'none', bgm: !!bgmTimer, sfxOn, bgmOn };
}
