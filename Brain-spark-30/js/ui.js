// BRAIN SPARK 30 — screens, navigation, shop, results
import {
  GAMES, GAME_BY_ID, SHOP, SHOP_TABS, TIERS, MILESTONES, CHEST, KIND_LABEL, trainingRanking, SEED_RANKING, GRADES,
} from './data.js';
import {
  getState, save, stats, cycleInfo, equipped, tierFor, itemOf, isOwned, buy, equip,
  claimMilestone, claimChest, startNextCycle, setNickname, setSetting, clearRecords,
} from './store.js';
import { Session } from './session.js';
import { sfx, unlockAudio, setBgmEnabled, setSfxEnabled } from './audio.js';
import { burst, ripple, haptic, setParticleStyle } from './fx.js';

const $ = (id) => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Math.round(n).toLocaleString('ko-KR');
const screenEl = (name) => qs(`[data-screen="${name}"]`);
const won = (n) => num(n);

const TEST = new URLSearchParams(location.search).has('test');

const ui = {
  tab: 'lobby',
  rankMode: 'challenge',
  rankGame: 'signal',
  shopKind: 'themes',
  session: null,
  lastResult: null,
  resultMode: 'challenge',
  resultGame: null,
};

/* ------------------------------------------------------------------- utils */

function icon(id, cls = '') {
  return `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
}

export function toast(message, glyph = '') {
  const stack = $('toast-stack');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = (glyph ? `<span>${glyph}</span>` : '') + `<span>${message}</span>`;
  stack.append(t);
  setTimeout(() => t.remove(), 2600);
}

function bumpCoins() {
  const pill = $('top-coins');
  pill.classList.remove('bump');
  void pill.offsetWidth;
  pill.classList.add('bump');
}

function refreshCoins() {
  $('coin-value').textContent = num(getState().coins);
}

function avatarHTML(item, frameItem, size = 'md') {
  const tint = item?.tint || 'linear-gradient(140deg,#37D9FF,#8C6BFF)';
  const glyph = item?.glyph || '🧠';
  return `<span class="avatar ${size} ${frameItem ? frameItem.cls : 'fr-basic'}" style="background:${tint}"><span class="glyph">${glyph}</span></span>`;
}

function applyLook() {
  const s = getState();
  const eq = equipped();
  $('frame').dataset.theme = s.profile.theme;
  setParticleStyle(s.profile.particle, getComputedStyle($('frame')).getPropertyValue('--accent').trim(), getComputedStyle($('frame')).getPropertyValue('--accent2').trim());
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle($('frame')).getPropertyValue('--bg').trim() || '#05070E');
  $('btn-bgm').setAttribute('aria-pressed', String(s.settings.bgm));
  $('btn-sfx').setAttribute('aria-pressed', String(s.settings.sfx));
  $('btn-bgm').innerHTML = icon('i-music');
  $('btn-sfx').innerHTML = icon(s.settings.sfx ? 'i-sound' : 'i-mute');
}

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60e3) return '방금 전';
  if (diff < 3600e3) return Math.floor(diff / 60e3) + '분 전';
  if (diff < 86400e3) return Math.floor(diff / 3600e3) + '시간 전';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* -------------------------------------------------------------------- modal */

let modalOnClose = null;

function openModal(html, { onMount } = {}) {
  const layer = $('modal-layer');
  $('modal-card').innerHTML = html;
  layer.hidden = false;
  layer.setAttribute('aria-hidden', 'false');
  if (onMount) onMount($('modal-card'));
}

function closeModal() {
  const layer = $('modal-layer');
  layer.hidden = true;
  layer.setAttribute('aria-hidden', 'true');
  $('modal-card').innerHTML = '';
  if (modalOnClose) { const f = modalOnClose; modalOnClose = null; f(); }
}

function confirmModal({ title, body, confirmLabel = '확인', cancelLabel = '취소', danger = false, onConfirm }) {
  openModal(`
    <h3>${title}</h3>
    <p>${body}</p>
    <div class="modal-actions">
      <button class="btn ghost" data-modal="cancel" type="button">${cancelLabel}</button>
      <button class="btn ${danger ? 'ghost' : 'primary'}" data-modal="ok" type="button" ${danger ? 'style="color:#FF8A96;border-color:rgba(255,107,122,.4)"' : ''}>${confirmLabel}</button>
    </div>`, {
    onMount(card) {
      qs('[data-modal="cancel"]', card).addEventListener('click', closeModal);
      qs('[data-modal="ok"]', card).addEventListener('click', () => { closeModal(); onConfirm && onConfirm(); });
    },
  });
}

/* ------------------------------------------------------------------- render */

export function renderAll() {
  applyLook();
  refreshCoins();
  renderTabDot();
  if (ui.tab === 'lobby') renderLobby();
  if (ui.tab === 'rank') renderRank();
  if (ui.tab === 'rewards') renderRewards();
  if (ui.tab === 'shop') renderShop();
  if (ui.tab === 'records') renderRecords();
}

function renderTabDot() {
  const cy = cycleInfo();
  $('reward-dot').hidden = !(cy.claimable.length || cy.chestReady);
}

export function setTab(name) {
  ui.tab = name;
  qsa('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
  qsa('.tab').forEach((t) => {
    if (t.dataset.tab === name) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  $('screens').scrollTop = 0;
  renderAll();
}

/* -------------------------------------------------------------------- lobby */

function renderLobby() {
  const s = getState();
  const st = stats();
  const cy = cycleInfo();
  const eq = equipped();
  const tier = tierFor(s.best);
  const recent = s.records.slice(0, 3);
  const pct = Math.min(100, (cy.count / 10) * 100);

  const html = `
  <div class="lobby">
    <div class="hero">
      <span class="hero-kicker">DAILY BRAIN BENCHMARK</span>
      <h1>30초, <span>두뇌 각성</span></h1>
      <p><b>9가지</b> 미니게임 <i class="hero-dot"></i> 매 판 랜덤 <i class="hero-dot"></i> 콤보 배수 <b>x4.0</b>까지</p>
    </div>

    <div class="profile-card card">
      <div class="pf-main">
        <button class="pf-avatar" data-act="go-shop-avatars" aria-label="아바타 변경" style="background:none;border:0;padding:0">${avatarHTML(eq.avatar, eq.frame, 'lg')}</button>
        <div class="pf-id">
          <div class="pf-name-row">
            <b>${esc(s.profile.nickname)}</b>
            <button class="pf-edit" data-act="edit-nick" aria-label="닉네임 수정">${icon('i-pencil')}</button>
          </div>
          <div class="pf-tags">
            <span class="title-chip">${esc(eq.title.name)}</span>
            <span class="tier-badge" style="color:${tier.color}">${tier.name}</span>
          </div>
          <div class="pf-stats">
            <div><span>최고 점수</span><b>${num(s.best)}</b></div>
            <div><span>평균 반응</span><b>${st.avgMs ? num(st.avgMs) : '—'}<i>ms</i></b></div>
            <div><span>총 판수</span><b>${num(st.games)}</b></div>
          </div>
        </div>
      </div>
      <div class="cycle">
        <div class="cycle-head"><span>🎁 10판 보상 진행</span><b>${cy.count}<span>/10</span></b></div>
        <div class="cycle-bar"><i style="width:${pct}%"></i></div>
      </div>
    </div>

    <button class="cta-main" data-act="start-challenge" type="button">
      <span class="cta-text"><b>⚡ 30초 종합 챌린지</b><i>지금 바로 두뇌 풀가동 · 매 판 랜덤</i></span>
      <span class="cta-go">${icon('i-play')}</span>
    </button>
    <div class="cta-row">
      <button class="cta-sub" data-act="open-training" type="button">${icon('i-target')} 종목별 트레이닝</button>
      <button class="cta-sub" data-act="go-records" type="button">${icon('i-chart')} 내 기록</button>
    </div>

    <section class="block">
      <div class="block-head"><h2>종목별 집중 트레이닝</h2><span>${GAMES.length}종</span></div>
      <div class="game-strip">
        ${GAMES.map((g) => {
          const best = s.trainingBest[g.id] || 0;
          return `<button class="gs-item" data-act="train:${g.id}" type="button">
            <span class="ico">${g.icon}</span>
            <b>${g.short}</b>
            <span class="${best ? 'best' : ''}">${best ? num(best) : '미도전'}</span>
          </button>`;
        }).join('')}
      </div>
    </section>

    <section class="block">
      <div class="block-head"><h2>최근 기록</h2><button data-act="go-records" type="button">전체 보기</button></div>
      ${recent.length ? `<div class="recent-list">${recent.map(recordRow).join('')}</div>`
        : `<div class="empty-note">아직 기록이 없어요. 30초 챌린지로 첫 기록을 남겨보세요!</div>`}
    </section>

    <section class="block">
      <div class="block-head"><h2>게임 가이드</h2><span>30초</span></div>
      <button class="guide-card" data-act="open-guide" type="button">
        <span class="guide-ico">🧠</span>
        <span class="guide-body"><b>9종 미니게임이 랜덤으로 나옵니다</b><span>콤보를 이어가면 점수 배수가 최대 x4.0까지 올라가요.</span></span>
        <span class="guide-go">›</span>
      </button>
    </section>
  </div>`;
  qs('[data-screen="lobby"]').innerHTML = html;
}

function recordRow(r) {
  const g = GRADES.find((x) => x.grade === r.grade) || GRADES[GRADES.length - 1];
  return `<div class="rec-row">
    <span class="rec-grade" style="color:${g.color};background:${g.color}18">${r.grade}</span>
    <div class="rec-body"><b>${esc(r.gameName)}</b><span>${timeAgo(r.at)} · 정답률 ${r.accuracy}% · ${r.avgMs ? r.avgMs + 'ms' : '—'}</span></div>
    <div class="rec-score"><b>${num(r.score)}</b><span>콤보 ${r.maxCombo}</span></div>
  </div>`;
}

/* ------------------------------------------------------------------ ranking */

function rankedRows() {
  const s = getState();
  const st = stats();
  const training = ui.rankMode === 'training';
  const base = training ? trainingRanking(ui.rankGame) : SEED_RANKING.slice();
  const myScore = training ? (s.trainingBest[ui.rankGame] || 0) : s.best;
  const rows = base.map((r) => ({ ...r, me: false }));
  rows.push({
    name: s.profile.nickname,
    score: myScore,
    avatar: s.profile.avatar,
    frame: s.profile.frame,
    title: s.profile.title,
    me: true,
    tag: '',
  });
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

function renderRank() {
  const s = getState();
  const eq = equipped();
  const rows = rankedRows();
  const meIdx = rows.findIndex((r) => r.me);
  const myRank = meIdx + 1;
  const training = ui.rankMode === 'training';

  const top = rows.slice(0, 3);
  const rest = rows.slice(3, 14);

  const medal = ['🥇', '🥈', '🥉'];
  const podiumOrder = [1, 0, 2];
  const podiumHTML = podiumOrder.map((idx) => {
    const r = top[idx];
    if (!r) return '';
    const avatarItem = itemOf('avatars', r.avatar) || SHOP.avatars[0];
    const frameItem = itemOf('frames', r.frame || 'basic') || SHOP.frames[0];
    const title = itemOf('titles', r.title)?.name || '';
    return `<div class="podium-item p${idx + 1}">
      ${idx === 0 ? '<span class="podium-crown">👑</span>' : ''}
      ${avatarHTML(avatarItem, frameItem, idx === 0 ? 'lg' : 'md')}
      <span class="p-name">${esc(r.name)}${r.me ? ' (나)' : ''}</span>
      <span class="p-score">${num(r.score)}</span>
      <div class="p-base">${medal[idx]}</div>
    </div>`;
  }).join('');

  const rowHTML = (r, i) => {
    const avatarItem = itemOf('avatars', r.avatar) || SHOP.avatars[0];
    const frameItem = itemOf('frames', r.frame || 'basic') || SHOP.frames[0];
    const tier = tierFor(r.score);
    const title = itemOf('titles', r.title);
    return `<li class="rk-row${r.me ? ' me' : ''}">
      <span class="rk-no ${i < 3 ? 'top' : ''}">${i + 1}</span>
      ${avatarHTML(avatarItem, frameItem, 'sm')}
      <div class="rk-name"><b>${esc(r.name)}${r.me ? ' <span class="rk-me-tag">ME</span>' : ''}</b><span style="color:${tier.color}">${title ? esc(title.name) : tier.name}</span></div>
      <span class="rk-score">${num(r.score)}</span>
    </li>`;
  };

  screenEl('rank').innerHTML = `
    <div class="page-head">
      <span class="kicker">LEADERBOARD</span>
      <h1>랭킹</h1>
      <p>${training ? '종목별 최고 기록으로 겨루는 트레이닝 랭킹' : '9가지 미니게임 30초 종합 챌린지 순위'}</p>
    </div>
    <div class="seg">
      <button class="${training ? '' : 'on'}" data-act="rank-mode:challenge" type="button">종합 랭킹</button>
      <button class="${training ? 'on' : ''}" data-act="rank-mode:training" type="button">트레이닝 랭킹</button>
    </div>
    ${training ? `<div class="game-chips">
      ${GAMES.map((g) => `<button class="${ui.rankGame === g.id ? 'on' : ''}" data-act="rank-game:${g.id}" type="button">${g.icon} ${g.short}</button>`).join('')}
    </div>` : ''}
    <div class="podium">${podiumHTML}</div>
    <ol class="rank-list">
      ${rest.map((r, i) => rowHTML(r, i + 3)).join('')}
    </ol>
    ${myRank > 14 ? `<div style="margin-top:8px"><ol class="rank-list">${rowHTML(rows[meIdx], meIdx)}</ol></div>` : ''}
    <div class="rank-note">내 최고 기록 ${num(training ? (s.trainingBest[ui.rankGame] || 0) : s.best)}점 · ${myRank}위${training ? ' · ' + (GAME_BY_ID[ui.rankGame]?.name || '') : ''}</div>
  `;
}

/* ------------------------------------------------------------------ rewards */

function renderRewards() {
  const cy = cycleInfo();
  const pct = Math.min(1, cy.count / 10);
  const C = 2 * Math.PI * 31;
  const offset = C * (1 - pct);

  const msHTML = MILESTONES.map((m) => {
    const claimed = cy.claimed.includes(m.at);
    const ready = !claimed && cy.count >= m.at;
    return `<div class="ms-item ${claimed ? 'done' : ''} ${ready ? 'ready' : ''}">
      <span class="ms-icon">${m.icon}</span>
      <div class="ms-body"><b>${m.label}</b><span><em>${m.coins}</em> 코인 · ${m.at}판 달성</span></div>
      ${claimed ? '<span class="ms-state ok">수령 완료</span>'
        : ready ? `<button class="btn gold small" data-act="claim:${m.at}" type="button">수령</button>`
          : `<span class="ms-state">${m.at - cy.count}판 남음</span>`}
    </div>`;
  }).join('');

  let chestState;
  if (cy.chest) chestState = `<button class="btn ghost small" data-act="next-cycle" type="button">다음 사이클 시작</button>`;
  else if (cy.chestReady) chestState = `<button class="btn gold small" data-act="claim-chest" type="button">상자 열기</button>`;
  else chestState = `<span class="ms-state">${10 - cy.count}판 남음</span>`;

  screenEl('rewards').innerHTML = `
    <div class="page-head">
      <span class="kicker">MILESTONE REWARDS</span>
      <h1>10판 보상</h1>
      <p>10판마다 사이클이 새로 시작됩니다. 매 사이클 보상을 다시 받으세요.</p>
    </div>
    <div class="cycle-hero card">
      <div class="ring">
        <svg viewBox="0 0 76 76" aria-hidden="true">
          <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style="stop-color:var(--accent)"/><stop offset="100%" style="stop-color:var(--accent2)"/>
          </linearGradient></defs>
          <circle class="trk" cx="38" cy="38" r="31"/>
          <circle class="val" cx="38" cy="38" r="31" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>
        </svg>
        <b>${cy.count}<i>/10</i></b>
      </div>
      <div class="cycle-info">
        <span class="kicker">CYCLE ${cy.index}</span>
        <h2>이번 사이클 ${cy.count}판</h2>
        <p>${cy.next ? `다음 보상까지 <b>${cy.toNext}판</b> · ${cy.next.coins} 코인` : (cy.chest ? '사이클 완료! 다음 사이클을 시작하세요.' : '<b>스페셜 상자</b>를 열 수 있어요!')}</p>
      </div>
    </div>
    <div class="dots10">
      ${Array.from({ length: 10 }, (_, i) => `<i class="${i < cy.count ? 'on' : ''}"></i>`).join('')}
    </div>
    <div class="milestones">${msHTML}</div>
    <div class="chest-card ${cy.chestReady ? 'ready' : cy.chest ? '' : 'locked'}">
      <span class="chest-art">${cy.chestReady ? '🎁' : '🔒'}</span>
      <div class="chest-body">
        <b>${CHEST.name}</b>
        <p>${CHEST.coins} 코인 + 한정 테마 <em>오로라</em> + 칭호 <em>10연전의 지배자</em></p>
      </div>
      ${chestState}
    </div>
    <p class="rank-note">보상은 10판마다 반복되며, 한정 아이템은 최초 1회만 지급됩니다(중복 시 코인으로 대체).</p>
  `;
}

/* --------------------------------------------------------------------- shop */

function itemPreview(kind, item, eq) {
  if (kind === 'themes') {
    const [a, b, c] = item.swatch;
    return `<div class="shop-preview theme-pv" style="--t1:${a};--t2:${b}33">
      <div class="pv-mini">
        <div class="pv-top"><span class="pv-av" style="background:${b}"></span><span class="pv-lines"><i></i><i></i></span></div>
        <span class="pv-cta" style="background:linear-gradient(135deg,${b},${c})"></span>
        <span class="pv-dots"><i></i><i></i><i></i><i></i></span>
      </div>
      <span class="pv-tag">${item.tag === '10판 보상' ? 'LIMITED' : 'THEME'}</span>
    </div>`;
  }
  if (kind === 'avatars') {
    return `<div class="shop-preview">${avatarHTML(item, eq.frame, 'lg')}</div>`;
  }
  if (kind === 'frames') {
    return `<div class="shop-preview">${avatarHTML(eq.avatar, item, 'lg')}</div>`;
  }
  if (kind === 'particles') {
    return `<div class="shop-preview"><div class="pv-particle">${icon('i-spark')}</div></div>`;
  }
  return `<div class="shop-preview"><span class="pv-title">${esc(item.name)}</span></div>`;
}

function renderShop() {
  const s = getState();
  const eq = equipped();
  const kind = ui.shopKind;
  const list = SHOP[kind] || [];
  const equippedId = { themes: s.profile.theme, avatars: s.profile.avatar, frames: s.profile.frame, particles: s.profile.particle, titles: s.profile.title }[kind];

  const cards = list.map((item) => {
    const owned = isOwned(kind, item.id);
    const isEq = equippedId === item.id;
    const locked = item.tag === '10판 보상';
    let act;
    if (isEq) act = `<button class="own" type="button" disabled>장착됨</button>`;
    else if (owned) act = `<button class="eq" data-act="equip:${kind}:${item.id}" type="button">장착</button>`;
    else if (locked) act = `<button class="buy locked" type="button" disabled>${icon('i-lock')} 10판 보상</button>`;
    else act = `<button class="buy" data-act="buy:${kind}:${item.id}" type="button"><span class="price-tag">${icon('i-coin')}${won(item.price)}</span></button>`;
    return `<div class="shop-item ${isEq ? 'equipped' : ''}">
      ${isEq ? '<span class="badge-eq">EQUIPPED</span>' : ''}
      ${itemPreview(kind, item, eq)}
      <div class="shop-meta"><b>${esc(item.name)}</b><span>${esc(item.desc || item.tag || '')}</span></div>
      <div class="shop-act">${act}</div>
    </div>`;
  }).join('');

  screenEl('shop').innerHTML = `
    <div class="page-head">
      <span class="kicker">CUSTOMIZE</span>
      <h1>커스터마이징</h1>
      <p>코인으로 테마·아바타·프레임·파티클·칭호를 해금하세요. 장착 즉시 적용됩니다.</p>
    </div>
    <div class="shop-wallet">
      <span class="lbl">보유 코인</span>
      <b>${icon('i-coin')}${num(s.coins)}</b>
    </div>
    <div class="shop-tabs">
      ${SHOP_TABS.map((t) => `<button class="${kind === t.id ? 'on' : ''}" data-act="shop-tab:${t.id}" type="button">${t.label}</button>`).join('')}
    </div>
    <div class="shop-grid">${cards}</div>
    <p class="rank-note">코인은 게임 결과로 쌓입니다. 점수가 높을수록 더 많이 획득!</p>
  `;
}

/* ------------------------------------------------------------------ records */

function chartSVG(records) {
  const pts = records.slice(0, 12).reverse();
  if (!pts.length) return '';
  const W = 320, H = 108, pad = 12;
  const max = Math.max(...pts.map((p) => p.score), 100);
  const min = 0;
  const stepX = pts.length > 1 ? (W - pad * 2) / (pts.length - 1) : 0;
  const y = (v) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2.6);
  const coords = pts.map((p, i) => [pad + i * stepX, y(p.score)]);
  const line = coords.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${yy.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${H - 6} L${coords[0][0].toFixed(1)},${H - 6} Z`;
  const grid = [0.25, 0.5, 0.75].map((f) => `<line class="grid" x1="0" x2="${W}" y1="${(H * f).toFixed(1)}" y2="${(H * f).toFixed(1)}"/>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="점수 추이">
    <defs>
      <linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" style="stop-color:var(--accent)"/><stop offset="100%" style="stop-color:var(--accent2)"/>
      </linearGradient>
      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" style="stop-color:var(--accent);stop-opacity:.28"/><stop offset="100%" style="stop-color:var(--accent);stop-opacity:0"/>
      </linearGradient>
    </defs>
    ${grid}
    <path class="area" d="${area}"/>
    <path class="line" d="${line}"/>
    ${coords.map(([x, yy], i) => `<circle class="dot" cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${i === coords.length - 1 ? 3.2 : 2}" />`).join('')}
  </svg>`;
}

function shareText() {
  const s = getState();
  const st = stats();
  const best = s.records.find((r) => r.score === s.best) || s.records[0];
  const lines = [
    '🧠 브레인 스파크 30 — 두뇌·반응속도 챌린지',
    `최고 점수 ${num(s.best)}점${best ? ` · 등급 ${best.grade}` : ''}`,
    st.avgMs ? `평균 반응속도 ${num(st.avgMs)}ms · 정답률 ${st.accuracy.toFixed(0)}% · 총 ${st.games}판` : `아직 기록 없음 (${st.games}판 플레이)`,
    '9가지 미니게임을 30초 안에! ' + location.href.split('?')[0],
  ];
  return lines.join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (err) { return false; }
  }
}

function renderRecords() {
  const s = getState();
  const st = stats();
  const recs = s.records;

  screenEl('records').innerHTML = `
    <div class="page-head">
      <span class="kicker">MY PERFORMANCE</span>
      <h1>내 기록</h1>
      <p>모든 판이 이 기기에 자동 저장됩니다. 새로고침해도 그대로 남아요.</p>
    </div>
    <div class="stat-grid">
      <div class="stat-tile"><span>최고 점수</span><b>${num(s.best)}</b></div>
      <div class="stat-tile"><span>평균 반응</span><b>${st.avgMs ? num(st.avgMs) : '—'}<i>ms</i></b></div>
      <div class="stat-tile"><span>총 판수</span><b>${num(st.games)}</b></div>
    </div>
    <div class="stat-grid">
      <div class="stat-tile"><span>평균 정답률</span><b>${recs.length ? st.accuracy.toFixed(0) : '—'}<i>%</i></b></div>
      <div class="stat-tile"><span>최대 콤보</span><b>${num(st.bestCombo)}</b></div>
      <div class="stat-tile"><span>현재 티어</span><b style="font-size:14px;color:${st.tier.color}">${st.tier.name}</b></div>
    </div>
    <div class="chart-card card">
      <div class="chart-head"><b>점수 추이</b><span>최근 ${Math.min(12, recs.length) || 0}판</span></div>
      ${recs.length ? chartSVG(recs) : '<div class="empty-note" style="margin:6px 0">기록이 쌓이면 그래프가 나타납니다.</div>'}
    </div>
    <div class="block-head" style="margin-bottom:8px"><h2>최근 기록</h2><span>${recs.length}건</span></div>
    <div class="hist">
      ${recs.length ? recs.map((r) => {
        const g = GRADES.find((x) => x.grade === r.grade) || GRADES[0];
        return `<div class="hist-row">
          <span class="hist-grade" style="color:${g.color};background:${g.color}18">${r.grade}</span>
          <div class="hist-body"><b>${esc(r.gameName)}${r.mode === 'training' ? ' · 트레이닝' : ''}</b><span>${timeAgo(r.at)} · 정답률 ${r.accuracy}% · 평균 ${r.avgMs || '—'}ms</span></div>
          <div class="hist-score"><b>${num(r.score)}</b><span>+${r.coins} 코인</span></div>
        </div>`;
      }).join('') : '<div class="empty-note">아직 기록이 없습니다. 첫 챌린지를 시작해 보세요!</div>'}
    </div>
    <div class="records-actions">
      <button class="btn ghost" data-act="share" type="button" style="flex:1">${icon('i-share')} 요약 복사</button>
      <button class="btn quiet" data-act="reset-records" type="button" style="border:1px solid var(--line)">${icon('i-reset')} 초기화</button>
    </div>
    <p class="rank-note">기록 초기화는 점수·판수만 지우며, 코인과 보유 아이템은 유지됩니다.</p>
  `;
}

/* -------------------------------------------------------------------- result */

function showResult(result) {
  ui.lastResult = result;
  ui.resultMode = result.mode;
  ui.resultGame = result.gameId;
  const g = result.grade;
  const total = result.brainScore + result.reactScore || 1;
  const brainPct = Math.round((result.brainScore / total) * 100);
  const reactPct = 100 - brainPct;
  const cy = cycleInfo();
  const gradeName = g.label;

  $('result-layer').innerHTML = `
    <div class="result-card">
      <span class="res-mode">${result.mode === 'training' ? 'FOCUS TRAINING' : '30S CHALLENGE'} · ${result.mode === 'training' ? esc(GAME_BY_ID[result.gameId]?.name || '') : '9종 랜덤'}</span>
      <div class="grade-wrap">
        <div class="grade-ring" style="--gc:${g.color}">
          <span class="grade-letter">${g.grade}</span>
          <span class="grade-label">${gradeName}</span>
        </div>
        <div class="res-score"><b id="res-score">0</b><span>점</span></div>
        <div class="res-best ${result.newBest ? 'new' : ''}">${result.newBest
          ? (result.prevBest ? `🏆 최고 기록 갱신! (+${num(result.score - result.prevBest)})` : '🏆 첫 기록 등록! 랭킹에 올랐어요')
          : `최고 기록 ${num(result.best)}점`}</div>
      </div>
      <div class="res-stats">
        <div><span>평균 반응</span><b>${result.avgMs || '—'}<small>ms</small></b></div>
        <div><span>정답률</span><b>${result.accuracy}<small>%</small></b></div>
        <div><span>최대 콤보</span><b>${result.maxCombo}</b></div>
        <div><span>정답</span><b>${result.correct}<small>/${result.rounds}</small></b></div>
      </div>
      <div class="balance">
        <div class="bal-head"><span>두뇌 회전 ${brainPct}%</span><span>반응 속도 ${reactPct}%</span></div>
        <div class="bal-bar"><i class="brain" style="width:${brainPct}%"></i><i class="react" style="width:${reactPct}%"></i></div>
        <div class="bal-vals"><span>${num(result.brainScore)}점</span><span>${num(result.reactScore)}점</span></div>
      </div>
      <div class="res-rewards">
        <div class="res-coins">${icon('i-coin')} +<b>${result.coins}</b> 코인 <span>· 보유 ${num(result.totalCoins)}</span></div>
        <div class="res-cycle">10판 보상<br><b>${cy.count}/10</b><i class="plus1">+1</i></div>
      </div>
      ${result.newBest ? `<div class="res-note">🏆 개인 최고 기록을 세웠어요. 랭킹에서 확인해 보세요!</div>` : ''}
      ${result.chestReady ? `<div class="res-note">🎁 스페셜 보상 상자가 준비됐어요! 보상 탭에서 열어보세요.</div>`
        : result.milestone ? `<div class="res-note">🎁 ${result.milestone}판 보상이 도착했어요! 보상 탭에서 수령하세요.</div>` : ''}
      <div class="res-actions">
        <button class="btn primary" data-res="retry" type="button">${icon('i-play')} 다시 도전</button>
        <button class="btn ghost" data-res="lobby" type="button">로비로</button>
        <button class="btn ghost res-share" data-res="share" type="button" aria-label="공유">${icon('i-share')}</button>
      </div>
    </div>`;

  const layer = $('result-layer');
  layer.hidden = false;
  layer.scrollTop = 0;

  // score count-up
  const el = $('res-score');
  const target = result.score;
  const t0 = performance.now();
  const dur = 760;
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = num(target * eased);
    if (k < 1) requestAnimationFrame(tick);
    else el.textContent = num(target);
  };
  requestAnimationFrame(tick);

  if (result.newBest) { sfx('record'); haptic('big'); }
  burst(layer.clientWidth / 2, 120, { count: 26, power: 1.6, colors: [g.color, '#FFFFFF', '#FFD76B'], lift: 0.5 });

  qsa('[data-res]', layer).forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.res;
    sfx('tap');
    if (act === 'retry') { hideResult(); startGame(ui.resultMode, ui.resultGame); }
    else if (act === 'lobby') { hideResult(); setTab('lobby'); }
    else if (act === 'share') copyText(shareResult(result)).then((ok) => toast(ok ? '결과 요약을 복사했어요!' : '복사에 실패했어요', ok ? '📋' : '⚠️'));
  }));
}

function shareResult(r) {
  return [
    `🧠 브레인 스파크 30 — ${r.mode === 'training' ? GAME_BY_ID[r.gameId]?.name : '30초 종합 챌린지'}`,
    `점수 ${num(r.score)}점 · 등급 ${r.grade.grade} (${r.grade.label})`,
    `평균 반응 ${r.avgMs || '—'}ms · 정답률 ${r.accuracy}% · 최대 콤보 ${r.maxCombo}`,
    location.href.split('?')[0],
  ].join('\n');
}

function hideResult() {
  $('result-layer').hidden = true;
  $('result-layer').innerHTML = '';
}

/* --------------------------------------------------------------------- game */

export function startGame(mode = 'challenge', gameId = null) {
  if (ui.session) return;
  unlockAudio();
  sfx('start');
  haptic('tap');
  hideResult();
  $('game-mode').textContent = mode === 'training' ? (GAME_BY_ID[gameId]?.name || '트레이닝') : '30초 종합 챌린지';
  $('hud-score').textContent = '0';
  $('combo-mult').textContent = 'x1.0';
  $('combo-count').textContent = '콤보 0';
  $('round-pips').innerHTML = '';
  $('game-layer').classList.remove('urgent');

  const session = new Session({ mode, gameId, test: TEST });
  ui.session = session;
  window.__BS30_SESSION__ = session;
  session.start(
    (result) => {
      ui.session = null;
      window.__BS30_SESSION__ = null;
      renderAll();
      showResult(result);
    },
    () => {
      ui.session = null;
      window.__BS30_SESSION__ = null;
      renderAll();
      setTab('lobby');
    },
  );
}

/* ------------------------------------------------------------------- actions */

function openTraining() {
  const s = getState();
  const rows = GAMES.map((g) => `
    <button data-train="${g.id}" type="button">
      <span class="ml-ico">${g.icon}</span>
      <span class="ml-body"><b>${g.name}</b><span>${g.desc} · ${KIND_LABEL[g.kind]}</span></span>
      <span class="ml-best">${s.trainingBest[g.id] ? num(s.trainingBest[g.id]) : '—'}</span>
    </button>`).join('');
  openModal(`
    <h3>종목별 집중 트레이닝</h3>
    <p>한 종목만 30초 동안 반복합니다. 최고 기록은 종목별로 저장돼요.</p>
    <div class="modal-list">${rows}</div>
    <div class="modal-actions"><button class="btn ghost" data-modal="cancel" type="button">닫기</button></div>`, {
    onMount(card) {
      qs('[data-modal="cancel"]', card).addEventListener('click', closeModal);
      qsa('[data-train]', card).forEach((b) => b.addEventListener('click', () => {
        closeModal();
        startGame('training', b.dataset.train);
      }));
    },
  });
}

function openGuide() {
  openModal(`
    <h3>브레인 스파크 30 플레이 가이드</h3>
    <p>30초 동안 두뇌 회전 5종과 반응속도 4종이 랜덤으로 등장합니다.</p>
    <div class="modal-list">
      <div class="ms-item"><span class="ms-icon">⚡</span><div class="ms-body"><b>빠를수록 더 많은 점수</b><span>정답 시간이 짧을수록 속도 보너스가 붙습니다.</span></div></div>
      <div class="ms-item"><span class="ms-icon">🔥</span><div class="ms-body"><b>콤보 배수 x1.0 → x4.0</b><span>연속 정답마다 배수가 올라가고, 틀리면 초기화됩니다.</span></div></div>
      <div class="ms-item"><span class="ms-icon">🎁</span><div class="ms-body"><b>10판마다 보상</b><span>1·3·5·7판 코인, 10판에는 한정 테마 상자까지.</span></div></div>
      <div class="ms-item"><span class="ms-icon">🎯</span><div class="ms-body"><b>종목별 트레이닝</b><span>약한 종목만 골라 30초 집중 연습할 수 있습니다.</span></div></div>
    </div>
    <div class="modal-actions"><button class="btn primary" data-modal="ok" type="button">알겠어요</button></div>`, {
    onMount(card) { qs('[data-modal="ok"]', card).addEventListener('click', closeModal); },
  });
}

function openNickModal() {
  const s = getState();
  openModal(`
    <h3>닉네임 수정</h3>
    <p>랭킹과 프로필에 표시됩니다. 1~12자, 공백 포함 가능.</p>
    <div class="field"><input id="nick-input" type="text" maxlength="12" value="${esc(s.profile.nickname)}" autocomplete="off" /></div>
    <div class="modal-note"><span>언제든 바꿀 수 있어요</span><span id="nick-count">${s.profile.nickname.length}/12</span></div>
    <div class="modal-actions">
      <button class="btn ghost" data-modal="cancel" type="button">취소</button>
      <button class="btn primary" data-modal="ok" type="button">저장</button>
    </div>`, {
    onMount(card) {
      const input = qs('#nick-input', card);
      const count = qs('#nick-count', card);
      setTimeout(() => { input.focus(); input.select(); }, 60);
      input.addEventListener('input', () => { count.textContent = `${input.value.length}/12`; });
      const commit = () => {
        const v = input.value.trim();
        if (!v) { toast('닉네임을 입력해 주세요', '✏️'); input.focus(); return; }
        setNickname(v);
        closeModal();
        sfx('equip');
        renderAll();
        toast('닉네임을 저장했어요', '✅');
      };
      qs('[data-modal="cancel"]', card).addEventListener('click', closeModal);
      qs('[data-modal="ok"]', card).addEventListener('click', commit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
    },
  });
}

function shopAction(kind, id) {
  const item = itemOf(kind, id);
  if (!item) return;
  if (isOwned(kind, id)) {
    equip(kind, id);
    applyLook();
    sfx('equip');
    toast(`${item.name} 장착 완료`, '✨');
    renderAll();
    return;
  }
  const res = buy(kind, id);
  if (!res.ok) {
    if (res.reason === 'coins') toast(`코인이 ${num(res.need)}개 부족해요`, '🪙');
    else if (res.reason === 'locked') toast('10판 보상에서만 얻을 수 있어요', '🎁');
    else toast('구매할 수 없어요', '⚠️');
    return;
  }
  equip(kind, id);
  applyLook();
  sfx('buy');
  haptic('correct');
  bumpCoins();
  toast(`${item.name} 구매 · 장착 완료`, '🛍️');
  burst($('frame').clientWidth / 2, 160, { count: 18, power: 1.2, colors: ['#FFD76B', '#FFFFFF', '#37D9FF'] });
  renderAll();
}

function equipAction(kind, id) {
  const item = itemOf(kind, id);
  if (!item) return;
  equip(kind, id);
  applyLook();
  sfx('equip');
  toast(`${item.name} 장착 완료`, '✨');
  renderAll();
}

/* ------------------------------------------------------------------- events */

function bindGlobal() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const [verb, a, b] = act.split(':');
    if (verb === 'start-challenge') startGame('challenge');
    else if (verb === 'open-training') openTraining();
    else if (verb === 'train') { startGame('training', a); }
    else if (verb === 'go-records') setTab('records');
    else if (verb === 'go-shop-avatars') { ui.shopKind = 'avatars'; setTab('shop'); }
    else if (verb === 'edit-nick') openNickModal();
    else if (verb === 'open-guide') openGuide();
    else if (verb === 'shop-tab') { ui.shopKind = a; renderShop(); }
    else if (verb === 'buy') shopAction(a, b);
    else if (verb === 'equip') equipAction(a, b);
    else if (verb === 'rank-mode') { ui.rankMode = a; renderRank(); }
    else if (verb === 'rank-game') { ui.rankGame = a; renderRank(); }
    else if (verb === 'claim') {
      const at = Number(a);
      const res = claimMilestone(at);
      if (res.ok) {
        sfx('claim'); haptic('correct');
        toast(`보상 ${res.coins} 코인 수령 완료`, '🎁');
        bumpCoins();
        burst($('frame').clientWidth / 2, 200, { count: 16, colors: ['#FFD76B', '#FFFFFF'] });
      }
      renderAll();
    } else if (verb === 'claim-chest') {
      const res = claimChest();
      if (res.ok) {
        sfx('chest'); haptic('big');
        bumpCoins();
        toast(`스페셜 상자: ${res.got.coins + res.got.bonus} 코인${res.got.theme ? ' + 오로라 테마' : ''}${res.got.title ? ' + 한정 칭호' : ''}`, '🎁');
        burst($('frame').clientWidth / 2, 220, { count: 34, power: 1.8, colors: ['#FFD76B', '#5CFFC8', '#FFFFFF', '#B071FF'], lift: 0.6 });
        openModal(`
          <h3>🎁 스페셜 보상 상자</h3>
          <p>10판을 완주한 보상입니다. 획득한 아이템은 커스터마이징에서 장착할 수 있어요.</p>
          <div class="modal-list">
            <div class="ms-item"><span class="ms-icon">🪙</span><div class="ms-body"><b>${res.got.coins} 코인</b><span>즉시 지급</span></div></div>
            <div class="ms-item"><span class="ms-icon">🌈</span><div class="ms-body"><b>오로라 테마</b><span>${res.got.theme ? '한정 테마 획득!' : '이미 보유 → 200 코인'}</span></div></div>
            <div class="ms-item"><span class="ms-icon">👑</span><div class="ms-body"><b>10연전의 지배자</b><span>${res.got.title ? '한정 칭호 획득!' : '이미 보유 → 200 코인'}</span></div></div>
          </div>
          <div class="modal-actions"><button class="btn primary" data-modal="ok" type="button">확인</button></div>`, {
          onMount(card) { qs('[data-modal="ok"]', card).addEventListener('click', closeModal); },
        });
      }
      renderAll();
    } else if (verb === 'next-cycle') {
      startNextCycle();
      sfx('start');
      toast('새 사이클 시작! 다시 10판 보상이 쌓입니다', '🔄');
      renderAll();
    } else if (verb === 'share') {
      copyText(shareText()).then((ok) => toast(ok ? '요약을 클립보드에 복사했어요' : '복사에 실패했어요', ok ? '📋' : '⚠️'));
    } else if (verb === 'reset-records') {
      confirmModal({
        title: '기록을 초기화할까요?',
        body: '점수·판수·트레이닝 최고 기록이 모두 삭제됩니다. 코인과 보유 아이템은 그대로 유지됩니다.',
        confirmLabel: '초기화',
        danger: true,
        onConfirm: () => {
          clearRecords();
          renderAll();
          toast('기록을 초기화했어요', '🧹');
        },
      });
    }
  });

  qsa('.tab').forEach((t) => t.addEventListener('click', () => { sfx('tap'); setTab(t.dataset.tab); }));

  // sound toggles
  $('btn-sfx').addEventListener('click', () => {
    const s = getState();
    const on = !s.settings.sfx;
    setSetting('sfx', on);
    setSfxEnabled(on);
    if (on) sfx('tick');
    applyLook();
  });
  $('btn-bgm').addEventListener('click', () => {
    const s = getState();
    const on = !s.settings.bgm;
    setSetting('bgm', on);
    setBgmEnabled(on);
    applyLook();
    if (on) { unlockAudio(); toast('배경음악 켬', '🎵'); } else toast('배경음악 끔', '🔇');
  });

  // game pause controls
  $('game-quit').addEventListener('click', () => { if (ui.session) ui.session.pause(); });
  $('btn-resume').addEventListener('click', () => { if (ui.session) ui.session.resume(); });
  $('btn-abort').addEventListener('click', () => {
    if (!ui.session) return;
    confirmModal({
      title: '게임을 그만둘까요?',
      body: '지금 나가면 이번 판 기록과 코인은 저장되지 않습니다.',
      confirmLabel: '그만두기',
      danger: true,
      onConfirm: () => { if (ui.session) ui.session.quit(); },
    });
  });

  // modal scrim
  qs('.modal-scrim').addEventListener('click', closeModal);

  // pause when the app goes to the background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ui.session && !ui.session.paused && !ui.session.ended) ui.session.pause();
  });

  // touch particles everywhere
  $('frame').addEventListener('pointerdown', (e) => {
    const rect = $('frame').getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    burst(x, y, { count: 5, power: 0.55, size: 2, lift: 0.1 });
    ripple(x, y, 'color-mix(in srgb, var(--accent) 60%, transparent)');
  });
}

/* --------------------------------------------------------------------- boot */

let booted = false;

export function boot() {
  if (booted) return;
  booted = true;
  document.body.dataset.test = TEST ? '1' : '0';
  setSfxEnabled(getState().settings.sfx);
  setBgmEnabled(getState().settings.bgm);
  bindGlobal();
  applyLook();
  refreshCoins();
  setTab('lobby');

  // hide splash
  setTimeout(() => {
    const sp = $('splash');
    sp.classList.add('off');
    setTimeout(() => { sp.style.display = 'none'; }, 600);
  }, 620);

  if (TEST) {
    window.__BS30_TEST__ = {
      state: () => JSON.parse(JSON.stringify(getState())),
      stats,
      start: (mode = 'challenge', gameId = null) => startGame(mode, gameId),
      session: () => window.__BS30_SESSION__,
      tab: (t) => setTab(t),
      result: () => ui.lastResult,
      closeResult: () => { hideResult(); setTab('lobby'); },
      openTraining,
      openNick: openNickModal,
      closeModal,
      ui,
      GAMES,
    };
  }
}
