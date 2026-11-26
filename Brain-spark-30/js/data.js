// BRAIN SPARK 30 — game catalogue, shop, leaderboard seeds
// Pure data, no DOM.

export const APP_VERSION = '1.0.0';

export const GAMES = [
  {
    id: 'signal', name: '신호등 캐치', short: '신호등', kind: 'react', icon: '🚦',
    desc: '초록불에만 탭! 보라색은 훼이크', tip: '초록불이 켜지는 순간을 노리세요. 보라색 신호는 절대 누르지 마세요.',
    limit: 3200,
  },
  {
    id: 'sniper', name: '타겟 스나이퍼', short: '스나이퍼', kind: 'react', icon: '🎯',
    desc: '폭탄은 피하고 황금 타겟만', tip: '황금 타겟만 정확히 노리세요. 빨간 폭탄을 누르면 실점입니다.',
    limit: 2800,
  },
  {
    id: 'order', name: '1→9 순서 터치', short: '순서터치', kind: 'react', icon: '🔢',
    desc: '숫자를 오름차순으로 빠르게', tip: '1부터 9까지 순서대로. 한 번 틀리면 라운드가 끝납니다.',
    limit: 6800,
  },
  {
    id: 'direction', name: '방향 러시', short: '방향', kind: 'react', icon: '🧭',
    desc: '조건에 맞는 방향을 탭', tip: '지시를 먼저 읽으세요. “반대”가 나오면 화살표의 반대로 누르세요.',
    limit: 2600,
  },
  {
    id: 'stroop', name: '스트룹 컬러 트랩', short: '스트룹', kind: 'brain', icon: '🎨',
    desc: '글자색? 글자 뜻? 지시를 읽어라', tip: '“글자색”과 “글자 뜻”을 잘 구분하세요. 색과 단어가 서로를 방해합니다.',
    limit: 3400,
  },
  {
    id: 'math', name: '번개 암산', short: '암산', kind: 'brain', icon: '⚡',
    desc: '빠르게 계산하고 정답 선택', tip: '정확하게, 그리고 빠르게. 시간이 지날수록 난이도가 올라갑니다.',
    limit: 4600,
  },
  {
    id: 'memory', name: '순간 기억력', short: '기억력', kind: 'brain', icon: '🧩',
    desc: '반짝인 칸의 순서를 기억', tip: '반짝인 칸을 순서대로 누르세요. 순서가 틀리면 라운드가 끝납니다.',
    limit: 0, // computed per round (flash time + answer window)
  },
  {
    id: 'odd', name: '다른 하나 찾기', short: '다른하나', kind: 'brain', icon: '🔍',
    desc: '미묘하게 다른 기호를 찾아라', tip: '같은 기호들 사이에 하나만 살짝 다릅니다. 모양과 회전을 보세요.',
    limit: 5200,
  },
  {
    id: 'match', name: '도형 매칭', short: '매칭', kind: 'brain', icon: '🔷',
    desc: '같은 기호 조합을 골라라', tip: '제시된 기호 조합과 순서까지 똑같은 것을 고르세요.',
    limit: 3200,
  },
];

export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));

export const KIND_LABEL = { react: '반응속도', brain: '두뇌 회전' };

/* ------------------------------------------------------------------ shop */

export const THEMES = [
  {
    id: 'studio', kind: 'themes', name: '스튜디오 다크', tag: '기본', price: 0,
    swatch: ['#0A101E', '#37D9FF', '#8C6BFF'], desc: '차분한 딥 네이비와 시안. BRAIN SPARK의 기본 스튜디오 톤.',
  },
  {
    id: 'sunset', kind: 'themes', name: '네온 선셋', tag: '코인', price: 420,
    swatch: ['#17101B', '#FF8A4C', '#FF4D8D'], desc: '노을빛 오렌지와 핫핑크. 게임이 뜨거워집니다.',
  },
  {
    id: 'lagoon', kind: 'themes', name: '라군 블루', tag: '코인', price: 560,
    swatch: ['#06141A', '#2BF5C4', '#2FA8FF'], desc: '청량한 민트와 아쿠아. 집중이 잘 되는 서늘한 톤.',
  },
  {
    id: 'violet', kind: 'themes', name: '로열 바이올렛', tag: '코인', price: 720,
    swatch: ['#0F0A1E', '#B071FF', '#FF5FD2'], desc: '깊은 퍼플과 마젠타. 프리미엄 아케이드 무드.',
  },
  {
    id: 'crimson', kind: 'themes', name: '크림슨 랩', tag: '코인', price: 880,
    swatch: ['#150A0C', '#FF5555', '#FFC24B'], desc: '붉은 랩과 황금 액센트. 승부욕을 자극하는 최상위 테마.',
  },
  {
    id: 'aurora', kind: 'themes', name: '오로라 (한정)', tag: '10판 보상', price: 0,
    swatch: ['#061219', '#5CFFC8', '#7C8CFF'], desc: '10판 보상 상자에서만 얻을 수 있는 한정 테마.',
  },
];

export const AVATARS = [
  { id: 'brain', kind: 'avatars', name: '두뇌 새싹', tag: '기본', price: 0, glyph: '🧠', tint: 'linear-gradient(140deg,#37D9FF,#8C6BFF)' },
  { id: 'fox', kind: 'avatars', name: '영리한 여우', tag: '코인', price: 120, glyph: '🦊', tint: 'linear-gradient(140deg,#FF9A57,#FF5D5D)' },
  { id: 'owl', kind: 'avatars', name: '야행성 부엉이', tag: '코인', price: 180, glyph: '🦉', tint: 'linear-gradient(140deg,#8C6BFF,#3E2C7A)' },
  { id: 'panda', kind: 'avatars', name: '느긋한 판다', tag: '코인', price: 200, glyph: '🐼', tint: 'linear-gradient(140deg,#B9C6DA,#5A6B8C)' },
  { id: 'tiger', kind: 'avatars', name: '집중의 호랑이', tag: '코인', price: 260, glyph: '🐯', tint: 'linear-gradient(140deg,#FFC24B,#FF7A2F)' },
  { id: 'octo', kind: 'avatars', name: '멀티태스킹 문어', tag: '코인', price: 320, glyph: '🐙', tint: 'linear-gradient(140deg,#FF6FB1,#8C6BFF)' },
  { id: 'alien', kind: 'avatars', name: '초지능 외계인', tag: '코인', price: 380, glyph: '👾', tint: 'linear-gradient(140deg,#5CFFC8,#2FA8FF)' },
  { id: 'unicorn', kind: 'avatars', name: '상상력 유니콘', tag: '코인', price: 460, glyph: '🦄', tint: 'linear-gradient(140deg,#FFB3E6,#B071FF)' },
  { id: 'fire', kind: 'avatars', name: '연소하는 뇌', tag: '코인', price: 520, glyph: '🔥', tint: 'linear-gradient(140deg,#FF8A4C,#FF2D55)' },
];

export const FRAMES = [
  { id: 'basic', kind: 'frames', name: '맑은 링', tag: '기본', price: 0, cls: 'fr-basic' },
  { id: 'bronze', kind: 'frames', name: '브론즈 링', tag: '코인', price: 140, cls: 'fr-bronze' },
  { id: 'silver', kind: 'frames', name: '실버 링', tag: '코인', price: 240, cls: 'fr-silver' },
  { id: 'holo', kind: 'frames', name: '홀로그램', tag: '코인', price: 420, cls: 'fr-holo' },
  { id: 'gold', kind: 'frames', name: '골드 크라운', tag: '코인', price: 620, cls: 'fr-gold' },
  { id: 'prism', kind: 'frames', name: '프리즘 오라', tag: '코인', price: 820, cls: 'fr-prism' },
];

export const PARTICLES = [
  { id: 'spark', kind: 'particles', name: '불꽃 스파크', tag: '기본', price: 0, desc: '짧게 튀는 시안 스파크' },
  { id: 'star', kind: 'particles', name: '별가루', tag: '코인', price: 200, desc: '반짝이며 흩어지는 별' },
  { id: 'bubble', kind: 'particles', name: '물방울', tag: '코인', price: 260, desc: '동글동글 떠오르는 버블' },
  { id: 'bolt', kind: 'particles', name: '번개', tag: '코인', price: 340, desc: '직선으로 튀는 전기 스파크' },
  { id: 'petal', kind: 'particles', name: '꽃잎', tag: '코인', price: 400, desc: '천천히 흩날리는 꽃잎' },
];

export const TITLES = [
  { id: 'rookie', kind: 'titles', name: '신입 관찰자', tag: '기본', price: 0 },
  { id: 'fast', kind: 'titles', name: '반응속도 장인', tag: '코인', price: 240 },
  { id: 'calc', kind: 'titles', name: '암산 요정', tag: '코인', price: 300 },
  { id: 'memory', kind: 'titles', name: '기억의 서랍', tag: '코인', price: 340 },
  { id: 'combo', kind: 'titles', name: '콤보 브레이커', tag: '코인', price: 420 },
  { id: 'thirty', kind: 'titles', name: '30초의 지배자', tag: '코인', price: 600 },
  { id: 'ten', kind: 'titles', name: '10연전의 지배자', tag: '10판 보상', price: 0 },
];

export const SHOP = { themes: THEMES, avatars: AVATARS, frames: FRAMES, particles: PARTICLES, titles: TITLES };

export const SHOP_TABS = [
  { id: 'themes', label: '테마' },
  { id: 'avatars', label: '아바타' },
  { id: 'frames', label: '프레임' },
  { id: 'particles', label: '파티클' },
  { id: 'titles', label: '칭호' },
];

/* -------------------------------------------------------------- tier/grade */

export const GRADES = [
  { grade: 'S+', min: 8000, color: '#5CFFC8', label: '전설적인 두뇌' },
  { grade: 'S', min: 6000, color: '#37D9FF', label: '프로 두뇌' },
  { grade: 'A', min: 4600, color: '#8C9BFF', label: '상위 15%' },
  { grade: 'B', min: 3400, color: '#C9A6FF', label: '평균 이상' },
  { grade: 'C', min: 2300, color: '#FFC24B', label: '성장 중' },
  { grade: 'D', min: 0, color: '#FF8A8A', label: '워밍업' },
];

export const TIERS = [
  { id: 'bronze', name: '브론즈', min: 0, color: '#D08A5A' },
  { id: 'silver', name: '실버', min: 2000, color: '#C3CEE0' },
  { id: 'gold', name: '골드', min: 3500, color: '#FFC24B' },
  { id: 'platinum', name: '플래티넘', min: 5000, color: '#6EE7E0' },
  { id: 'diamond', name: '다이아', min: 6500, color: '#8FB4FF' },
  { id: 'master', name: '마스터', min: 8000, color: '#FF7AD9' },
];

export const MILESTONES = [
  { at: 1, coins: 60, label: '첫 판 보상', icon: '🎈' },
  { at: 3, coins: 120, label: '3판 보상', icon: '🎁' },
  { at: 5, coins: 180, label: '5판 보상', icon: '💎' },
  { at: 7, coins: 240, label: '7판 보상', icon: '🏅' },
];

export const CHEST = { coins: 500, theme: 'aurora', title: 'ten', name: '스페셜 보상 상자' };

/* -------------------------------------------------------------- leaderboard */

export const SEED_RANKING = [
  { name: '새벽의직관', score: 9280, avatar: 'owl', title: 'thirty', tag: '마스터' },
  { name: '시냅스폭주', score: 8740, avatar: 'fire', title: 'combo', tag: '' },
  { name: '초록불사냥꾼', score: 8310, avatar: 'fox', title: 'fast', tag: '' },
  { name: '계산기인간', score: 7890, avatar: 'alien', title: 'calc', tag: '' },
  { name: '픽셀브레인', score: 7460, avatar: 'unicorn', title: 'memory', tag: '' },
  { name: '반사신경만렙', score: 7020, avatar: 'tiger', title: 'fast', tag: '' },
  { name: '기억의서랍', score: 6580, avatar: 'panda', title: 'memory', tag: '' },
  { name: '두뇌풀가동', score: 6140, avatar: 'brain', title: 'combo', tag: '' },
  { name: '스트룹생존자', score: 5710, avatar: 'octo', title: 'thirty', tag: '' },
  { name: '콤보수집가', score: 5280, avatar: 'fox', title: 'combo', tag: '' },
  { name: '번개손가락', score: 4860, avatar: 'alien', title: 'fast', tag: '' },
  { name: '집중력훈련중', score: 4410, avatar: 'owl', title: 'rookie', tag: '' },
  { name: '하루한판', score: 3980, avatar: 'panda', title: 'rookie', tag: '' },
  { name: '주말의두뇌', score: 3540, avatar: 'brain', title: 'rookie', tag: '' },
  { name: '신입관찰자', score: 3120, avatar: 'brain', title: 'rookie', tag: '' },
];

// Deterministic per-game training leaderboards (seeded, no storage needed).
const TRAIN_SEEDS = {
  signal: [6120, 5780, 5450, 5120, 4790, 4460, 4130, 3800, 3470, 3140],
  sniper: [5960, 5630, 5310, 4980, 4660, 4340, 4020, 3700, 3380, 3060],
  order: [6380, 6020, 5670, 5310, 4960, 4610, 4260, 3910, 3560, 3210],
  direction: [6180, 5840, 5500, 5160, 4830, 4490, 4160, 3820, 3490, 3150],
  stroop: [6020, 5690, 5360, 5030, 4700, 4370, 4050, 3720, 3390, 3060],
  math: [6450, 6090, 5730, 5370, 5010, 4660, 4300, 3940, 3580, 3220],
  memory: [6280, 5930, 5580, 5230, 4890, 4540, 4200, 3850, 3510, 3160],
  odd: [6080, 5740, 5410, 5070, 4740, 4410, 4080, 3740, 3410, 3080],
  match: [6210, 5870, 5530, 5190, 4860, 4520, 4180, 3840, 3500, 3160],
};
const TRAIN_NAMES = ['새벽의직관', '초록불사냥꾼', '픽셀브레인', '반사신경만렙', '기억의서랍', '두뇌풀가동', '콤보수집가', '번개손가락', '집중력훈련중', '하루한판'];
const TRAIN_AVATARS = ['owl', 'fox', 'unicorn', 'tiger', 'panda', 'brain', 'octo', 'alien', 'owl', 'panda'];

export function trainingRanking(gameId) {
  const scores = TRAIN_SEEDS[gameId] || TRAIN_SEEDS.signal;
  return scores.map((score, i) => ({
    name: TRAIN_NAMES[i],
    score,
    avatar: TRAIN_AVATARS[i],
    title: 'rookie',
    tag: '',
  }));
}

export const NICK_ADJ = ['번개', '고요한', '새벽', '네온', '기민한', '집요한', '차분한', '폭주하는'];
export const NICK_NOUN = ['두뇌', '시냅스', '관찰자', '계산기', '기억술사', '반사신경'];
