// BRAIN SPARK 30 — persistent player state (localStorage)
import { CHEST, GAMES, GRADES, MILESTONES, SHOP, TIERS, GAME_BY_ID } from './data.js';

const KEY = 'brainspark30.v1';

export function defaultState() {
  return {
    v: 1,
    createdAt: Date.now(),
    profile: { nickname: '두뇌 신동', avatar: 'brain', frame: 'basic', title: 'rookie', theme: 'studio', particle: 'spark' },
    coins: 200,
    best: 0,
    gamesPlayed: 0,
    cycle: { index: 1, count: 0, claimed: [], chest: false },
    records: [],
    trainingBest: {},
    owned: {
      themes: ['studio'],
      avatars: ['brain'],
      frames: ['basic'],
      particles: ['spark'],
      titles: ['rookie'],
    },
    settings: { sfx: true, bgm: true },
    introSeen: false,
  };
}

function merge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  const out = { ...base, ...saved };
  out.profile = { ...base.profile, ...(saved.profile || {}) };
  out.settings = { ...base.settings, ...(saved.settings || {}) };
  out.owned = { ...base.owned, ...(saved.owned || {}) };
  out.cycle = { ...base.cycle, ...(saved.cycle || {}) };
  if (!Array.isArray(out.records)) out.records = [];
  if (!Array.isArray(out.cycle.claimed)) out.cycle.claimed = [];
  if (!out.trainingBest || typeof out.trainingBest !== 'object') out.trainingBest = {};
  // never lose a default item
  for (const kind of Object.keys(base.owned)) {
    const set = new Set([...(out.owned[kind] || []), ...base.owned[kind]]);
    out.owned[kind] = [...set];
  }
  return out;
}

let state;
try {
  const raw = localStorage.getItem(KEY);
  state = merge(defaultState(), raw ? JSON.parse(raw) : null);
} catch (e) {
  state = defaultState();
}

export function getState() {
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) { /* storage full / blocked — game keeps running in memory */ }
}

/* ------------------------------------------------------------------ lookup */

export function itemOf(kind, id) {
  const list = SHOP[kind] || [];
  return list.find((i) => i.id === id) || null;
}

export function tierFor(score = state.best) {
  let out = TIERS[0];
  for (const t of TIERS) if (score >= t.min) out = t;
  return out;
}

export function gradeFor(score) {
  for (const g of GRADES) if (score >= g.min) return g;
  return GRADES[GRADES.length - 1];
}

export function equipped() {
  const p = state.profile;
  return {
    theme: itemOf('themes', p.theme) || SHOP.themes[0],
    avatar: itemOf('avatars', p.avatar) || SHOP.avatars[0],
    frame: itemOf('frames', p.frame) || SHOP.frames[0],
    particle: itemOf('particles', p.particle) || SHOP.particles[0],
    title: itemOf('titles', p.title) || SHOP.titles[0],
  };
}

/* ------------------------------------------------------------------- coins */

export function addCoins(n) {
  state.coins = Math.max(0, state.coins + Math.round(n));
  save();
  return state.coins;
}

export function spend(n) {
  if (state.coins < n) return false;
  state.coins -= n;
  save();
  return true;
}

export function isOwned(kind, id) {
  return (state.owned[kind] || []).includes(id);
}

export function buy(kind, id) {
  const item = itemOf(kind, id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (isOwned(kind, id)) return { ok: false, reason: 'owned' };
  if (item.tag === '10판 보상') return { ok: false, reason: 'locked' };
  if (state.coins < item.price) return { ok: false, reason: 'coins', need: item.price - state.coins };
  state.coins -= item.price;
  state.owned[kind].push(id);
  save();
  return { ok: true, item };
}

const EQUIP_KEY = { themes: 'theme', avatars: 'avatar', frames: 'frame', particles: 'particle', titles: 'title' };

export function equip(kind, id) {
  if (!isOwned(kind, id)) return { ok: false, reason: 'locked' };
  const key = EQUIP_KEY[kind];
  if (!key) return { ok: false, reason: 'unknown' };
  state.profile[key] = id;
  save();
  return { ok: true, item: itemOf(kind, id) };
}

export function grant(kind, id) {
  if (!isOwned(kind, id)) {
    state.owned[kind].push(id);
    save();
    return true;
  }
  return false;
}

export function setNickname(name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 12);
  if (!clean) return false;
  state.profile.nickname = clean;
  save();
  return true;
}

export function setSetting(key, value) {
  state.settings[key] = !!value;
  save();
}

/* ----------------------------------------------------------------- records */

export function stats() {
  const recs = state.records;
  const rounds = recs.reduce((a, r) => a + (r.rounds || 0), 0);
  const correct = recs.reduce((a, r) => a + (r.correct || 0), 0);
  const msRecs = recs.filter((r) => r.avgMs > 0);
  const avgMs = msRecs.length ? msRecs.reduce((a, r) => a + r.avgMs, 0) / msRecs.length : 0;
  const bestCombo = recs.reduce((a, r) => Math.max(a, r.maxCombo || 0), 0);
  return {
    games: state.gamesPlayed,
    best: state.best,
    avgMs,
    accuracy: rounds ? (correct / rounds) * 100 : 0,
    bestCombo,
    tier: tierFor(state.best),
  };
}

export function cycleInfo() {
  const c = state.cycle;
  const next = MILESTONES.find((m) => m.at > c.count);
  const ready = MILESTONES.filter((m) => c.count >= m.at && !c.claimed.includes(m.at));
  return {
    ...c,
    toNext: next ? next.at - c.count : 0,
    next: next || null,
    claimable: ready.map((m) => m.at),
    chestReady: c.count >= 10 && !c.chest,
  };
}

/** Applies a finished session. Returns a summary the result screen needs. */
export function recordGame(result) {
  const prevBest = state.best;
  const isChallenge = result.mode === 'challenge';
  const newBest = isChallenge && result.score > prevBest;

  if (newBest) state.best = result.score;
  if (result.mode === 'training') {
    const gid = result.gameId;
    if (!state.trainingBest[gid] || result.score > state.trainingBest[gid]) state.trainingBest[gid] = result.score;
  }

  state.gamesPlayed += 1;
  const c = state.cycle;
  c.count = Math.min(10, c.count + 1);

  const entry = {
    id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    mode: result.mode,
    gameId: result.gameId || null,
    gameName: result.gameId ? (GAME_BY_ID[result.gameId]?.name || result.gameId) : '30초 종합 챌린지',
    score: result.score,
    grade: result.grade.grade,
    accuracy: result.accuracy,
    avgMs: result.avgMs,
    maxCombo: result.maxCombo,
    rounds: result.rounds,
    correct: result.correct,
    coins: result.coins,
    brainScore: result.brainScore,
    reactScore: result.reactScore,
    reactMsSum: result.reactMsSum,
  };
  state.records.unshift(entry);
  if (state.records.length > 60) state.records.length = 60;

  addCoins(result.coins);
  save();

  const milestone = MILESTONES.find((m) => m.at === c.count && !c.claimed.includes(m.at));
  return {
    newBest,
    prevBest,
    best: state.best,
    milestone: milestone ? milestone.at : null,
    chestReady: c.count >= 10 && !c.chest,
    coins: state.coins,
  };
}

export function claimMilestone(at) {
  const c = state.cycle;
  const ms = MILESTONES.find((m) => m.at === at);
  if (!ms || c.count < at || c.claimed.includes(at)) return { ok: false };
  c.claimed.push(at);
  addCoins(ms.coins);
  save();
  return { ok: true, coins: ms.coins };
}

export function claimChest() {
  const c = state.cycle;
  if (c.count < 10 || c.chest) return { ok: false };
  c.chest = true;
  const got = { coins: CHEST.coins, theme: false, title: false, bonus: 0 };
  addCoins(CHEST.coins);
  if (grant('themes', CHEST.theme)) got.theme = true; else { addCoins(200); got.bonus += 200; }
  if (grant('titles', CHEST.title)) got.title = true; else { addCoins(200); got.bonus += 200; }
  save();
  return { ok: true, got };
}

export function startNextCycle() {
  const c = state.cycle;
  if (!c.chest) return { ok: false };
  state.cycle = { index: c.index + 1, count: 0, claimed: [], chest: false };
  save();
  return { ok: true, index: state.cycle.index };
}

export function clearRecords() {
  state.records = [];
  state.best = 0;
  state.gamesPlayed = 0;
  state.trainingBest = {};
  save();
  return true;
}

export function markIntroSeen() {
  state.introSeen = true;
  save();
}

export function exportState() {
  return JSON.stringify(state, null, 2);
}

export function gameCountFor(kind) {
  return GAMES.filter((g) => g.kind === kind).length;
}
