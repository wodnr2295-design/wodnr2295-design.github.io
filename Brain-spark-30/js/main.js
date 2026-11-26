// BRAIN SPARK 60 — entry point
import { initFX, resize } from './fx.js';
import { boot } from './ui.js';
import { unlockAudio } from './audio.js';

initFX(document.getElementById('fx-canvas'));
boot();
window.addEventListener('load', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 220));

// browsers only allow audio after a gesture
const unlock = () => unlockAudio();
document.addEventListener('pointerdown', unlock, { once: true });
document.addEventListener('keydown', unlock, { once: true });
