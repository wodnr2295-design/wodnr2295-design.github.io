// BRAIN SPARK 30 — touch particles, ripples and haptics
let canvas = null;
let ctx2d = null;
let dpr = 1;
let W = 0;
let H = 0;
let running = false;
let last = 0;
let style = 'spark';
let colorA = '#37D9FF';
let colorB = '#8C6BFF';
const particles = [];
const rings = [];
const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initFX(el) {
  canvas = el;
  ctx2d = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
}

export function resize() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = rect.width;
  H = rect.height;
  canvas.width = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  if (ctx2d) ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function setParticleStyle(id, a, b) {
  style = id || 'spark';
  if (a) colorA = a;
  if (b) colorB = b;
}

function palette(extra) {
  if (extra && extra.length) return extra;
  return [colorA, colorB, '#FFFFFF'];
}

export function burst(x, y, opts = {}) {
  if (!canvas || reduced) return;
  const count = opts.count || 12;
  const power = opts.power || 1;
  const colors = palette(opts.colors);
  for (let i = 0; i < count; i++) {
    const ang = opts.dir != null ? opts.dir + (Math.random() - 0.5) * (opts.spread || 1.2) : Math.random() * Math.PI * 2;
    const sp = (0.09 + Math.random() * 0.22) * power * 3.2;
    particles.push({
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - (opts.lift || 0),
      life: 1,
      decay: 0.016 + Math.random() * 0.02,
      size: (opts.size || 2.4) * (0.6 + Math.random() * 0.9),
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.25,
      style,
      grav: opts.grav != null ? opts.grav : 0.00045,
    });
  }
  kick();
}

export function ripple(x, y, color) {
  if (!canvas || reduced) return;
  rings.push({ x, y, r: 6, life: 1, color: color || colorA });
  kick();
}

export function hazeBurst(x, y, color) {
  if (!canvas || reduced) return;
  for (let i = 0; i < 3; i++) rings.push({ x, y, r: 4 + i * 12, life: 0.7, color: color || colorB });
  kick();
}

function kick() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

function frame(now) {
  const dt = Math.max(0, Math.min(48, now - last)) / 16.67;
  last = now;
  if (!ctx2d) { running = false; return; }
  ctx2d.clearRect(0, 0, W, H);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.grav * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.rot += p.spin * dt;
    p.life -= p.decay * dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx2d.save();
    ctx2d.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx2d.fillStyle = p.color;
    ctx2d.strokeStyle = p.color;
    ctx2d.translate(p.x, p.y);
    ctx2d.rotate(p.rot);
    switch (p.style) {
      case 'star':
        drawStar(ctx2d, p.size * 1.35);
        break;
      case 'bubble':
        ctx2d.globalAlpha *= 0.6;
        ctx2d.beginPath();
        ctx2d.arc(0, 0, Math.max(0.5, p.size * 1.1), 0, Math.PI * 2);
        ctx2d.stroke();
        break;
      case 'bolt':
        ctx2d.lineWidth = 1.4;
        ctx2d.beginPath();
        ctx2d.moveTo(-p.size * 2, 0);
        ctx2d.lineTo(p.size * 2, 0);
        ctx2d.stroke();
        break;
      case 'petal':
        ctx2d.beginPath();
        ctx2d.ellipse(0, 0, p.size * 1.5, p.size * 0.7, 0, 0, Math.PI * 2);
        ctx2d.fill();
        break;
      default:
        ctx2d.beginPath();
        ctx2d.arc(0, 0, Math.max(0.5, p.size * 0.9), 0, Math.PI * 2);
        ctx2d.fill();
    }
    ctx2d.restore();
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.r = Math.max(1, r.r + (7 - r.r * 0.16) * dt);
    r.life -= 0.06 * dt;
    if (r.life <= 0) { rings.splice(i, 1); continue; }
    ctx2d.save();
    ctx2d.globalAlpha = Math.max(0, r.life) * 0.32;
    ctx2d.strokeStyle = r.color;
    ctx2d.lineWidth = 1.6;
    ctx2d.beginPath();
    ctx2d.arc(r.x, r.y, Math.max(0.5, r.r), 0, Math.PI * 2);
    ctx2d.stroke();
    ctx2d.restore();
  }

  if (particles.length || rings.length) {
    requestAnimationFrame(frame);
  } else {
    running = false;
    ctx2d.clearRect(0, 0, W, H);
  }
}

function drawStar(c, r) {
  c.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const a2 = a + Math.PI / 5;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    c.lineTo(Math.cos(a2) * r * 0.42, Math.sin(a2) * r * 0.42);
  }
  c.closePath();
  c.fill();
}

export function haptic(kind = 'tap') {
  if (!navigator.vibrate) return;
  try {
    if (kind === 'correct') navigator.vibrate(12);
    else if (kind === 'wrong') navigator.vibrate([28, 40, 18]);
    else if (kind === 'big') navigator.vibrate([10, 30, 14, 30, 20]);
    else navigator.vibrate(6);
  } catch (e) { /* ignore */ }
}

export function prefersReduced() { return reduced; }
