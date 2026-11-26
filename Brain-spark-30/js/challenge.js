// BRAIN SPARK 60 — challenge links (URL-safe base64 payload, no dependencies)

const B64_SAFE = (bin) => btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromB64Safe(token) {
  let t = String(token || '').replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return atob(t);
}

function toBinary(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return bin;
}

/** Short, URL-safe token that carries a player's result. */
export function encodeChallenge(rec) {
  const payload = {
    v: 1,
    n: String(rec.name || '').slice(0, 12),
    s: Math.round(Number(rec.score) || 0),
    m: Math.round(Number(rec.avgMs) || 0),
    a: Math.round(Number(rec.accuracy) || 0),
    c: Math.round(Number(rec.maxCombo) || 0),
    av: rec.avatar || 'brain',
    fr: rec.frame || 'basic',
    ti: rec.title || 'rookie',
    md: rec.mode === 'training' ? 't' : 'c',
    t: Number(rec.playedAt && Date.parse(rec.playedAt)) || Date.now(),
  };
  return B64_SAFE(toBinary(JSON.stringify(payload)));
}

/** Decodes a token back into a friend record; null when it is not usable. */
export function decodeChallenge(token) {
  try {
    const bin = fromB64Safe(token);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object') return null;
    const name = String(data.n || '').replace(/\s+/g, ' ').trim().slice(0, 12);
    const score = Number(data.s);
    if (!name || !Number.isFinite(score) || score <= 0) return null;
    const t = Number(data.t);
    return {
      name,
      score: Math.min(999999, Math.round(score)),
      avgMs: Math.max(0, Math.min(99999, Math.round(Number(data.m) || 0))),
      accuracy: Math.max(0, Math.min(100, Math.round(Number(data.a) || 0))),
      maxCombo: Math.max(0, Math.min(999, Math.round(Number(data.c) || 0))),
      avatar: typeof data.av === 'string' ? data.av : 'brain',
      frame: typeof data.fr === 'string' ? data.fr : 'basic',
      title: typeof data.ti === 'string' ? data.ti : 'rookie',
      mode: data.md === 't' ? 'training' : 'challenge',
      playedAt: Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : null,
    };
  } catch (e) {
    return null;
  }
}

export function baseUrl() {
  return location.origin + location.pathname;
}

export function challengeUrl(rec) {
  return `${baseUrl()}?c=${encodeChallenge(rec)}`;
}

export function challengeMessage(rec, url) {
  const score = Math.round(Number(rec.score) || 0).toLocaleString('ko-KR');
  return `🧠 브레인 스파크에서 ${score}점 찍음! 이길 수 있으면 눌러봐 👉 ${url}`;
}
