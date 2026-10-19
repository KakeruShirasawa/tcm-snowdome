// ============================================================
// 降らせるもののプリセット（3Dスノードームで使用）
//
//  shape   : 粒の形（globe3d.js の drawSprite）
//  size    : 粒の大きさの範囲（小さい粒ほど多くなるように分布）
//  fall    : 沈む速さ（重いほど速い。マイナスは浮かぶ）
//  flutter : ひらひら横にゆれる強さ
//  spin    : くるくる回る速さ
//  tumble  : 裏返るように薄くなる度合い（紙・花びら・ラメ）
//  flash   : 光を受けてキラッと光る強さ（ラメ）
//  density : 量スライダーに対する実際の粒数の割合（大きい粒ほど少なく）
// ============================================================

const PARTICLE_GROUPS = [
  ['snow', '雪', 'Schnee'],
  ['glitter', 'きらめき（ラメ）', 'Glitzer'],
  ['fun', 'おたのしみ', 'Spaß'],
];

const PARTICLE_PRESETS = {
  snow: {
    group: 'snow', density: 1, name: '雪', desc: 'ふわっと舞い\nゆっくり積もる',
    colors: ['#ffffff', '#f3f8ff', '#e6f0ff'],
    shape: 'circle', size: [1.2, 4.6], fall: 0.11, flutter: 0.7, spin: 0, tumble: 0, flash: 0,
  },
  powder: {
    group: 'snow', density: 1.3, name: '粉雪', desc: '細かい粒が\nしんしんと',
    colors: ['#ffffff', '#eef5ff'],
    shape: 'circle', size: [0.7, 2.2], fall: 0.07, flutter: 0.45, spin: 0, tumble: 0, flash: 0,
  },
  botan: {
    group: 'snow', density: 0.32, name: 'ぼたん雪', desc: '大きな雪が\nひらひら',
    colors: ['#ffffff', '#f6faff'],
    shape: 'flake', size: [3.5, 8.5], fall: 0.12, flutter: 1.3, spin: 0.5, tumble: 0.35, flash: 0,
  },
  crystal: {
    group: 'snow', density: 0.28, name: '雪の結晶', desc: '六角の結晶が\nくるくる回る',
    colors: ['#ffffff', '#e2efff', '#cfe3ff'],
    shape: 'crystal', size: [3.5, 7.5], fall: 0.1, flutter: 0.9, spin: 1.1, tumble: 0.3, flash: 0.35,
  },
  gold: {
    group: 'glitter', density: 0.9, name: 'ゴールド', desc: '傾くたびに\nキラッと光る',
    colors: ['#ffd77a', '#ffe9b0', '#d9ad5c'],
    shape: 'glint', size: [1.6, 3.6], fall: 0.19, flutter: 0.5, spin: 3.2, tumble: 1, flash: 1,
  },
  silver: {
    group: 'glitter', density: 0.9, name: 'シルバー', desc: '白銀に\nきらめくラメ',
    colors: ['#ffffff', '#dfe8f2', '#b8c8d8'],
    shape: 'glint', size: [1.6, 3.6], fall: 0.18, flutter: 0.5, spin: 3.0, tumble: 1, flash: 1,
  },
  aurora: {
    group: 'glitter', density: 0.8, name: 'オーロラ', desc: '虹色に\nきらめくラメ',
    colors: ['#ff9fd0', '#9fd8ff', '#b7ffcf', '#ffe59f', '#c9a8ff'],
    shape: 'glint', size: [1.8, 4], fall: 0.17, flutter: 0.6, spin: 2.8, tumble: 1, flash: 1,
  },
  star: {
    group: 'glitter', density: 0.35, name: '星くず', desc: '小さな星が\nまたたく',
    colors: ['#ffd77a', '#fff1c9', '#ffffff'],
    shape: 'star', size: [3, 6.5], fall: 0.1, flutter: 0.8, spin: 0.7, tumble: 0.2, flash: 0.6,
  },
  confetti: {
    group: 'fun', density: 0.45, name: '紙吹雪', desc: '裏返りながら\n舞い落ちる',
    colors: ['#c8202c', '#1f5a3a', '#e8c46a', '#f5ead5', '#8b1821'],
    shape: 'rect', size: [3.5, 6.5], fall: 0.2, flutter: 1.2, spin: 2.2, tumble: 1, flash: 0.2,
  },
  petal: {
    group: 'fun', density: 0.35, name: '花びら', desc: 'ゆらゆら\n揺れて落ちる',
    colors: ['#ffb3d1', '#ffd0e2', '#ffe6ef'],
    shape: 'petal', size: [4, 8], fall: 0.1, flutter: 1.7, spin: 1.2, tumble: 0.8, flash: 0,
  },
  heart: {
    group: 'fun', density: 0.3, name: 'ハート', desc: '赤とピンクの\nハート',
    colors: ['#e83a5a', '#ff7a9a', '#ffb3c6'],
    shape: 'heart', size: [4, 8], fall: 0.12, flutter: 1.0, spin: 0.6, tumble: 0.5, flash: 0,
  },
  bubble: {
    group: 'fun', density: 0.12, name: 'シャボン玉', desc: '下から\n浮かんでくる',
    colors: ['#d2ecff', '#ffe0f0', '#dcffe8'],
    shape: 'bubble', size: [4, 11], fall: -0.12, flutter: 0.9, spin: 0, tumble: 0, flash: 0.3,
  },
};
