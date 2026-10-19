// ============================================================
// パーツカタログ
// ChatGPT画像で差し替え可能なダミーSVG
// 各パーツは colorable:true のとき、primary 色を {{PRIMARY}} として展開
// ============================================================

// 共通パレット（色変更チップ用）
const COLOR_PALETTE = [
  { name: '公式レッド', hex: '#8b1821' },
  { name: 'ネイビー',   hex: '#1b2a52' },
  { name: 'グリーン',   hex: '#1f4b2e' },
  { name: 'ゴールド',   hex: '#c9a66b' },
  { name: 'シルバー',   hex: '#b8c0c8' },
  { name: 'ホワイト',   hex: '#f5ead5' },
  { name: 'ピンク',     hex: '#e68aa8' },
  { name: 'パープル',   hex: '#6b4a8a' },
  { name: 'スカイ',     hex: '#4a7fb5' },
  { name: 'オレンジ',   hex: '#d8711f' },
  { name: 'ブラウン',   hex: '#5a3a1a' },
  { name: 'ブラック',   hex: '#1a1a1a' },
];

// 台座テーマ
const BASE_THEMES = {
  walnut: {
    name: 'ウォルナット',
    stops: [['#2e1b10', 0], ['#5a3822', 0.5], ['#24140a', 1]],
    stroke: '#120804',
  },
  wood_dark: {
    name: 'ダーク木目',
    stops: [['#3a2418', 0], ['#6b4a30', 0.5], ['#2a1a0a', 1]],
    stroke: '#1a0a04',
  },
  wood_light: {
    name: 'ライト木目',
    stops: [['#8a6a3a', 0], ['#b89060', 0.5], ['#6a4a2a', 1]],
    stroke: '#4a2a1a',
  },
  gold: {
    name: 'ゴールド',
    stops: [['#8a6020', 0], ['#e8c789', 0.4], ['#a07820', 1]],
    stroke: '#5a3a10',
  },
  silver: {
    name: 'シルバー',
    stops: [['#808890', 0], ['#d0d8e0', 0.4], ['#60686e', 1]],
    stroke: '#30363c',
  },
  marble: {
    name: '大理石',
    stops: [['#e8e2d4', 0], ['#f5efe0', 0.5], ['#c8c0b0', 1]],
    stroke: '#6a6050',
  },
  black: {
    name: 'ブラック',
    stops: [['#1a1a1a', 0], ['#3a3a3a', 0.5], ['#0a0a0a', 1]],
    stroke: '#000',
  },
};

// ガラス枠テーマ
const GLASS_THEMES = {
  gold: { name: 'ゴールド', stroke: 'rgba(201,166,107,0.65)', shine: 'rgba(255,245,220,0.35)' },
  silver: { name: 'シルバー', stroke: 'rgba(200,210,220,0.65)', shine: 'rgba(255,255,255,0.35)' },
  black: { name: 'ブラック', stroke: 'rgba(30,30,30,0.7)', shine: 'rgba(255,255,255,0.25)' },
  red: { name: 'レッド', stroke: 'rgba(139,24,33,0.7)', shine: 'rgba(255,220,210,0.3)' },
  none: { name: '無し', stroke: 'rgba(255,255,255,0.15)', shine: 'rgba(255,255,255,0.25)' },
};

// パーツSVG生成関数（{{PRIMARY}} をプレースホルダに）
const PARTS_CATALOG = {
  backgrounds: [
    { id: 'bg-snowfield', name: '雪景色',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="bg_a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1a2847"/><stop offset="0.5" stop-color="#3a4f7a"/><stop offset="1" stop-color="#e8eef5"/>
        </linearGradient></defs>
        <rect width="600" height="600" fill="url(#bg_a)"/>
        <path d="M0 480 Q150 420 300 460 T600 440 L600 600 L0 600 Z" fill="#f5f8fc"/>
        <path d="M0 520 Q180 470 360 500 T600 490 L600 600 L0 600 Z" fill="#ffffff" opacity="0.85"/>
      </svg>` },
    { id: 'bg-town', name: 'ドイツの街並み',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="bg_b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1b3f"/><stop offset="1" stop-color="#7a5a8f"/></linearGradient></defs>
        <rect width="600" height="600" fill="url(#bg_b)"/>
        <g fill="#1a1030">
          <rect x="40" y="320" width="90" height="200"/><polygon points="40,320 85,260 130,320"/>
          <rect x="140" y="280" width="110" height="240"/><polygon points="140,280 195,220 250,280"/>
          <rect x="260" y="300" width="80" height="220"/><polygon points="260,300 300,250 340,300"/>
          <rect x="350" y="260" width="120" height="260"/><polygon points="350,260 410,190 470,260"/>
          <rect x="480" y="310" width="80" height="210"/><polygon points="480,310 520,260 560,310"/>
        </g>
        <g fill="#ffd77a">
          <rect x="60" y="350" width="14" height="18"/><rect x="95" y="380" width="14" height="18"/>
          <rect x="165" y="320" width="14" height="18"/><rect x="210" y="360" width="14" height="18"/>
          <rect x="280" y="340" width="14" height="18"/><rect x="380" y="300" width="14" height="18"/>
          <rect x="420" y="340" width="14" height="18"/><rect x="500" y="360" width="14" height="18"/>
        </g>
        <path d="M0 500 L600 500 L600 600 L0 600 Z" fill="#efe8d8" opacity="0.9"/>
      </svg>` },
    { id: 'bg-market', name: 'クリスマスマーケット',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
        <defs><radialGradient id="bg_c" cx="0.5" cy="0.3" r="0.9"><stop offset="0" stop-color="#5a2a1a"/><stop offset="1" stop-color="#1a0808"/></radialGradient></defs>
        <rect width="600" height="600" fill="url(#bg_c)"/>
        <g><rect x="80" y="330" width="140" height="170" fill="#5a3822"/><polygon points="60,330 150,260 240,330" fill="#7a1818"/><rect x="110" y="380" width="80" height="60" fill="#ffd77a" opacity="0.85"/>
          <rect x="380" y="330" width="140" height="170" fill="#5a3822"/><polygon points="360,330 450,260 540,330" fill="#7a1818"/><rect x="410" y="380" width="80" height="60" fill="#ffd77a" opacity="0.85"/></g>
        <g fill="#ffe088"><circle cx="80" cy="150" r="4"/><circle cx="140" cy="130" r="4"/><circle cx="200" cy="140" r="4"/><circle cx="260" cy="120" r="4"/>
          <circle cx="320" cy="130" r="4"/><circle cx="380" cy="140" r="4"/><circle cx="440" cy="120" r="4"/><circle cx="500" cy="150" r="4"/></g>
        <path d="M0 500 L600 500 L600 600 L0 600 Z" fill="#efe8d8" opacity="0.9"/>
      </svg>` },
    { id: 'bg-starry', name: '星空',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="bg_d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06102e"/><stop offset="1" stop-color="#1a2a5a"/></linearGradient></defs>
        <rect width="600" height="600" fill="url(#bg_d)"/>
        <g fill="#ffffff"><circle cx="60" cy="80" r="1.5"/><circle cx="140" cy="50" r="2"/><circle cx="220" cy="110" r="1.5"/><circle cx="310" cy="60" r="2.5"/><circle cx="390" cy="90" r="1.5"/><circle cx="470" cy="40" r="2"/><circle cx="540" cy="120" r="2"/><circle cx="100" cy="200" r="1.5"/><circle cx="260" cy="180" r="2"/><circle cx="440" cy="220" r="1.5"/><circle cx="520" cy="260" r="2"/><circle cx="80" cy="300" r="1.5"/></g>
        <circle cx="470" cy="130" r="40" fill="#ffe8a8"/><circle cx="455" cy="120" r="40" fill="#06102e"/>
        <path d="M0 490 Q200 440 400 470 T600 450 L600 600 L0 600 Z" fill="#e8eef5" opacity="0.95"/>
      </svg>` },
    { id: 'bg-pink', name: '夕暮れ',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="bg_e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9ec7"/><stop offset="0.5" stop-color="#ffb98f"/><stop offset="1" stop-color="#fff0e0"/></linearGradient></defs>
        <rect width="600" height="600" fill="url(#bg_e)"/>
        <path d="M0 500 Q150 450 300 480 T600 460 L600 600 L0 600 Z" fill="#ffffff" opacity="0.9"/>
      </svg>` },
    { id: 'bg-forest', name: '夜の森',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="bg_f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1a1a"/><stop offset="1" stop-color="#1a3828"/></linearGradient></defs>
        <rect width="600" height="600" fill="url(#bg_f)"/>
        <g fill="#0a2818"><polygon points="40,480 80,320 120,480"/><polygon points="100,480 150,280 200,480"/><polygon points="180,480 230,340 280,480"/><polygon points="260,480 310,300 360,480"/><polygon points="340,480 390,320 440,480"/><polygon points="420,480 470,290 520,480"/><polygon points="500,480 550,340 600,480"/></g>
        <path d="M0 480 Q200 460 400 475 T600 470 L600 600 L0 600 Z" fill="#ffffff" opacity="0.9"/>
      </svg>` },
  ],

  objects: [
    { id: 'obj-tree', name: 'ツリー', w: 180, h: 240, colorable: true, defaultColor: '#1a5a2a',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 240">
        <polygon points="90,10 150,90 110,90 170,180 20,180 70,90 30,90" fill="{{PRIMARY}}" stroke="#0a3a1a" stroke-width="2"/>
        <rect x="75" y="180" width="30" height="30" fill="#5a3a1a"/>
        <polygon points="90,0 95,15 110,20 95,25 90,40 85,25 70,20 85,15" fill="#ffd700"/>
        <circle cx="60" cy="120" r="6" fill="#e8321f"/><circle cx="110" cy="140" r="6" fill="#ffd700"/>
        <circle cx="85" cy="160" r="6" fill="#e8321f"/><circle cx="125" cy="170" r="6" fill="#ffd700"/>
      </svg>` },
    { id: 'obj-church', name: '教会', w: 180, h: 240, colorable: true, defaultColor: '#7a1818',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 240">
        <rect x="40" y="110" width="100" height="100" fill="#e8dcc0" stroke="#6a4a2a" stroke-width="2"/>
        <polygon points="40,110 90,70 140,110" fill="{{PRIMARY}}"/>
        <rect x="80" y="30" width="20" height="90" fill="#e8dcc0" stroke="#6a4a2a" stroke-width="2"/>
        <polygon points="80,30 90,10 100,30" fill="{{PRIMARY}}"/>
        <line x1="90" y1="0" x2="90" y2="30" stroke="#6a4a2a" stroke-width="2"/><line x1="82" y1="15" x2="98" y2="15" stroke="#6a4a2a" stroke-width="2"/>
        <rect x="80" y="150" width="20" height="60" fill="#5a3a1a"/>
        <circle cx="60" cy="140" r="6" fill="#ffd77a"/><circle cx="120" cy="140" r="6" fill="#ffd77a"/>
      </svg>` },
    { id: 'obj-pyramid', name: 'ピラミッド', w: 160, h: 240,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 240">
        <polygon points="80,20 100,40 60,40" fill="#c08030"/><line x1="80" y1="20" x2="80" y2="220" stroke="#6a4a2a" stroke-width="2"/>
        <polygon points="80,40 150,30 140,55 80,55" fill="#e8c070" stroke="#8a5a2a" stroke-width="1.5"/>
        <polygon points="80,40 10,30 20,55 80,55" fill="#e8c070" stroke="#8a5a2a" stroke-width="1.5"/>
        <ellipse cx="80" cy="90" rx="55" ry="10" fill="#6a4a2a"/><rect x="35" y="90" width="90" height="40" fill="#8a5a3a"/>
        <ellipse cx="80" cy="130" rx="55" ry="10" fill="#5a3a1a"/>
        <ellipse cx="80" cy="150" rx="65" ry="10" fill="#6a4a2a"/><rect x="20" y="150" width="120" height="50" fill="#8a5a3a"/>
        <ellipse cx="80" cy="200" rx="65" ry="10" fill="#5a3a1a"/>
        <circle cx="55" cy="110" r="6" fill="#ffd77a"/><circle cx="105" cy="110" r="6" fill="#e8321f"/>
        <circle cx="50" cy="175" r="7" fill="#1a5a2a"/><circle cx="80" cy="175" r="7" fill="#e8321f"/><circle cx="110" cy="175" r="7" fill="#ffd77a"/>
      </svg>` },
    { id: 'obj-cottage', name: '雪の家', w: 200, h: 180, colorable: true, defaultColor: '#7a1818',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180">
        <rect x="30" y="80" width="140" height="80" fill="#f0e0c0" stroke="#6a4a2a" stroke-width="2"/>
        <polygon points="20,80 100,20 180,80" fill="{{PRIMARY}}" stroke="#4a0808" stroke-width="2"/>
        <polygon points="20,80 100,20 180,80 175,75 100,25 25,75" fill="#ffffff"/>
        <rect x="85" y="110" width="30" height="50" fill="#5a3a1a"/>
        <rect x="45" y="100" width="25" height="25" fill="#ffd77a"/><rect x="130" y="100" width="25" height="25" fill="#ffd77a"/>
        <rect x="50" y="55" width="18" height="30" fill="#9a7a5a"/>
      </svg>` },
    { id: 'obj-giftbox', name: 'プレゼント', w: 140, h: 140, colorable: true, defaultColor: '#e8321f',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
        <rect x="15" y="40" width="110" height="90" fill="{{PRIMARY}}" stroke="#8a0808" stroke-width="2"/>
        <rect x="60" y="40" width="20" height="90" fill="#ffd700"/>
        <rect x="15" y="40" width="110" height="20" fill="#f0f0f0"/>
        <rect x="60" y="40" width="20" height="20" fill="#ffd700"/>
        <ellipse cx="55" cy="30" rx="18" ry="12" fill="#ffd700"/><ellipse cx="85" cy="30" rx="18" ry="12" fill="#ffd700"/>
        <circle cx="70" cy="30" r="6" fill="{{PRIMARY}}"/>
      </svg>` },
    { id: 'obj-nutcracker', name: 'くるみ割り人形', w: 100, h: 220, colorable: true, defaultColor: '#8b1821',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 220">
        <rect x="30" y="30" width="40" height="18" fill="#1a1a1a"/>
        <rect x="25" y="48" width="50" height="4" fill="#ffd700"/>
        <rect x="35" y="52" width="30" height="38" fill="#ffd4b0"/>
        <circle cx="42" cy="65" r="2.5" fill="#1a1a1a"/><circle cx="58" cy="65" r="2.5" fill="#1a1a1a"/>
        <rect x="40" y="72" width="20" height="6" fill="#1a1a1a"/>
        <rect x="35" y="78" width="30" height="12" fill="#ffffff"/>
        <rect x="22" y="90" width="56" height="80" fill="{{PRIMARY}}" stroke="#5a0808" stroke-width="2"/>
        <circle cx="50" cy="105" r="3" fill="#ffd700"/><circle cx="50" cy="120" r="3" fill="#ffd700"/><circle cx="50" cy="135" r="3" fill="#ffd700"/>
        <rect x="25" y="170" width="22" height="40" fill="#1a1a1a"/><rect x="53" y="170" width="22" height="40" fill="#1a1a1a"/>
      </svg>` },
  ],

  characters: [
    { id: 'char-santa', name: 'サンタ', w: 100, h: 140, colorable: true, defaultColor: '#e8321f',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140">
        <polygon points="30,30 70,30 55,0" fill="{{PRIMARY}}"/>
        <ellipse cx="30" cy="30" rx="8" ry="5" fill="#ffffff"/><circle cx="55" cy="0" r="5" fill="#ffffff"/>
        <rect x="25" y="28" width="50" height="8" fill="#ffffff"/>
        <circle cx="50" cy="50" r="18" fill="#ffd4b0"/>
        <path d="M 32 55 Q 50 85 68 55 Q 68 75 50 80 Q 32 75 32 55" fill="#ffffff"/>
        <circle cx="43" cy="50" r="2" fill="#1a1a1a"/><circle cx="57" cy="50" r="2" fill="#1a1a1a"/>
        <circle cx="50" cy="60" r="4" fill="{{PRIMARY}}"/>
        <rect x="30" y="78" width="40" height="50" fill="{{PRIMARY}}"/>
        <rect x="30" y="120" width="40" height="10" fill="#1a1a1a"/>
        <circle cx="40" cy="124" r="3" fill="#ffd700"/>
      </svg>` },
    { id: 'char-reindeer', name: 'トナカイ', w: 140, h: 160,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 160">
        <ellipse cx="70" cy="100" rx="50" ry="30" fill="#8a5a3a"/>
        <rect x="35" y="120" width="8" height="30" fill="#5a3a1a"/><rect x="55" y="125" width="8" height="25" fill="#5a3a1a"/>
        <rect x="80" y="125" width="8" height="25" fill="#5a3a1a"/><rect x="100" y="120" width="8" height="30" fill="#5a3a1a"/>
        <circle cx="40" cy="70" r="22" fill="#8a5a3a"/>
        <path d="M 30 50 L 25 30 L 15 25 M 25 30 L 20 20 M 25 30 L 32 25" stroke="#5a3a1a" stroke-width="2.5" fill="none"/>
        <path d="M 50 50 L 55 30 L 65 25 M 55 30 L 60 20 M 55 30 L 48 25" stroke="#5a3a1a" stroke-width="2.5" fill="none"/>
        <circle cx="34" cy="68" r="2" fill="#1a1a1a"/><circle cx="46" cy="68" r="2" fill="#1a1a1a"/>
        <circle cx="40" cy="80" r="5" fill="#e8321f"/>
      </svg>` },
    { id: 'char-sled', name: 'そり', w: 180, h: 100, colorable: true, defaultColor: '#e8321f',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 100">
        <path d="M 20 60 Q 90 50 160 60 L 160 80 Q 90 70 20 80 Z" fill="#8a3a1a" stroke="#5a1a08" stroke-width="2"/>
        <path d="M 10 85 Q 90 95 170 85 L 170 90 Q 90 100 10 90 Z" fill="#5a3a1a"/>
        <rect x="40" y="30" width="100" height="30" fill="{{PRIMARY}}" stroke="#8a0808" stroke-width="2"/>
        <circle cx="60" cy="20" r="4" fill="#ffd700"/><circle cx="90" cy="15" r="5" fill="#ffd700"/><circle cx="120" cy="20" r="4" fill="#ffd700"/>
      </svg>` },
    { id: 'char-snowman', name: '雪だるま', w: 100, h: 150, colorable: true, defaultColor: '#e8321f',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150">
        <circle cx="50" cy="110" r="35" fill="#ffffff" stroke="#c0d0e0" stroke-width="2"/>
        <circle cx="50" cy="55" r="25" fill="#ffffff" stroke="#c0d0e0" stroke-width="2"/>
        <circle cx="44" cy="52" r="2" fill="#1a1a1a"/><circle cx="56" cy="52" r="2" fill="#1a1a1a"/>
        <polygon points="50,55 60,60 50,65" fill="#ff8c00"/>
        <path d="M 42 68 Q 50 72 58 68" stroke="#1a1a1a" stroke-width="1.5" fill="none"/>
        <rect x="30" y="20" width="40" height="20" fill="#1a1a1a"/><rect x="35" y="10" width="30" height="15" fill="#1a1a1a"/>
        <rect x="30" y="35" width="40" height="4" fill="{{PRIMARY}}"/>
        <rect x="25" y="80" width="50" height="12" fill="{{PRIMARY}}"/><rect x="60" y="88" width="12" height="20" fill="{{PRIMARY}}"/>
        <circle cx="50" cy="100" r="3" fill="#1a1a1a"/><circle cx="50" cy="115" r="3" fill="#1a1a1a"/><circle cx="50" cy="130" r="3" fill="#1a1a1a"/>
      </svg>` },
    { id: 'char-penguin', name: 'ペンギン', w: 80, h: 120,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120">
        <ellipse cx="40" cy="70" rx="30" ry="40" fill="#1a1a2a"/>
        <ellipse cx="40" cy="75" rx="20" ry="30" fill="#ffffff"/>
        <circle cx="33" cy="40" r="2.5" fill="#ffffff"/><circle cx="47" cy="40" r="2.5" fill="#ffffff"/>
        <circle cx="33" cy="40" r="1.5" fill="#1a1a1a"/><circle cx="47" cy="40" r="1.5" fill="#1a1a1a"/>
        <polygon points="40,45 46,50 40,55 34,50" fill="#ff8c00"/>
        <polygon points="30,115 42,110 42,118" fill="#ff8c00"/><polygon points="50,115 38,110 38,118" fill="#ff8c00"/>
      </svg>` },
    { id: 'char-angel', name: '天使', w: 100, h: 140, colorable: true, defaultColor: '#1f4b2e',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140">
        <ellipse cx="50" cy="25" rx="20" ry="4" fill="none" stroke="#ffd700" stroke-width="2.5"/>
        <circle cx="50" cy="42" r="15" fill="#ffd4b0"/>
        <circle cx="45" cy="42" r="1.8" fill="#1a1a1a"/><circle cx="55" cy="42" r="1.8" fill="#1a1a1a"/>
        <path d="M 46 48 Q 50 52 54 48" stroke="#1a1a1a" stroke-width="1" fill="none"/>
        <path d="M 30 70 L 50 60 L 70 70 L 68 125 L 32 125 Z" fill="{{PRIMARY}}" stroke="#0a2a0a" stroke-width="1.5"/>
        <path d="M 30 70 Q 10 60 5 90 Q 20 85 30 80 Z" fill="#ffffff" opacity="0.9"/>
        <path d="M 70 70 Q 90 60 95 90 Q 80 85 70 80 Z" fill="#ffffff" opacity="0.9"/>
      </svg>` },
  ],

  decorations: [
    { id: 'deco-ornament', name: 'オーナメント', w: 60, h: 80, colorable: true, defaultColor: '#e8321f',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
        <line x1="30" y1="0" x2="30" y2="15" stroke="#8a6a2a" stroke-width="2"/>
        <rect x="26" y="12" width="8" height="8" fill="#c0a060"/>
        <circle cx="30" cy="45" r="22" fill="{{PRIMARY}}" stroke="#5a0808" stroke-width="2"/>
        <ellipse cx="22" cy="35" rx="5" ry="8" fill="#ffffff" opacity="0.5"/>
        <path d="M 10 45 Q 30 55 50 45" stroke="#ffd700" stroke-width="2" fill="none"/>
      </svg>` },
    { id: 'deco-wreath', name: 'リース', w: 100, h: 100,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#1a5a2a" stroke-width="14"/>
        <circle cx="30" cy="40" r="5" fill="#e8321f"/><circle cx="70" cy="45" r="5" fill="#e8321f"/><circle cx="50" cy="15" r="5" fill="#e8321f"/>
        <circle cx="20" cy="60" r="4" fill="#ffd700"/><circle cx="80" cy="65" r="4" fill="#ffd700"/><circle cx="60" cy="85" r="5" fill="#e8321f"/>
        <path d="M 40 15 L 50 5 L 60 15 L 55 25 L 45 25 Z" fill="#e8321f"/>
      </svg>` },
    { id: 'deco-candle', name: 'キャンドル', w: 50, h: 100,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 100">
        <rect x="18" y="30" width="14" height="55" fill="#f0e8d0" stroke="#8a7a5a" stroke-width="1.5"/>
        <ellipse cx="25" cy="30" rx="7" ry="2.5" fill="#e8d8b0"/>
        <line x1="25" y1="20" x2="25" y2="30" stroke="#1a1a1a" stroke-width="1"/>
        <ellipse cx="25" cy="15" rx="4" ry="8" fill="#ffd700"/><ellipse cx="25" cy="12" rx="2" ry="5" fill="#ffffff"/>
        <ellipse cx="25" cy="88" rx="18" ry="5" fill="#1a5a2a"/>
        <circle cx="12" cy="88" r="3" fill="#e8321f"/><circle cx="40" cy="88" r="3" fill="#e8321f"/>
      </svg>` },
    { id: 'deco-star', name: '星', w: 60, h: 60, colorable: true, defaultColor: '#ffd700',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
        <polygon points="30,3 37,22 57,22 41,34 47,53 30,42 13,53 19,34 3,22 23,22" fill="{{PRIMARY}}" stroke="#8a6020" stroke-width="1.5"/>
      </svg>` },
    { id: 'deco-stocking', name: '靴下', w: 80, h: 110, colorable: true, defaultColor: '#e8321f',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 110">
        <path d="M 20 10 L 60 10 L 60 70 Q 60 85 70 90 L 70 100 L 15 100 L 15 90 Q 15 85 20 80 Z" fill="{{PRIMARY}}" stroke="#5a0808" stroke-width="2"/>
        <rect x="18" y="10" width="44" height="15" fill="#ffffff" stroke="#5a0808" stroke-width="1"/>
      </svg>` },
    { id: 'deco-candycane', name: 'ステッキ', w: 50, h: 110, colorable: true, defaultColor: '#e8321f',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 110">
        <path d="M 15 100 L 15 30 Q 15 10 30 10 Q 42 10 42 25" stroke="#ffffff" stroke-width="12" fill="none" stroke-linecap="round"/>
        <path d="M 15 100 L 15 30 Q 15 10 30 10 Q 42 10 42 25" stroke="{{PRIMARY}}" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="8 8"/>
      </svg>` },
    { id: 'deco-bell', name: 'ベル', w: 70, h: 90, colorable: true, defaultColor: '#ffd700',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 90">
        <path d="M 35 15 Q 15 15 15 50 L 10 65 L 60 65 L 55 50 Q 55 15 35 15 Z" fill="{{PRIMARY}}" stroke="#8a6020" stroke-width="2"/>
        <circle cx="35" cy="75" r="7" fill="#8a6020"/>
        <path d="M 25 10 Q 35 0 45 10" stroke="#2a5a1a" stroke-width="3" fill="none"/>
      </svg>` },
    { id: 'deco-holly', name: 'ヒイラギ', w: 80, h: 70,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 70">
        <path d="M 40 10 L 55 20 L 70 15 L 65 30 L 75 40 L 60 42 L 55 55 L 40 48 L 25 55 L 20 42 L 5 40 L 15 30 L 10 15 L 25 20 Z" fill="#1a5a2a" stroke="#0a3a1a" stroke-width="1.5"/>
        <circle cx="35" cy="35" r="5" fill="#e8321f"/><circle cx="45" cy="40" r="5" fill="#e8321f"/><circle cx="40" cy="48" r="4" fill="#e8321f"/>
      </svg>` },
  ],
};

// ───────── ChatGPT制作の本番パーツ（画像） ─────────
// img を持つパーツは SVG の代わりに画像で描画する（色変更は不可）
PARTS_CATALOG.characters = [
  { id: 'char-santa',       name: 'サンタ',           img: 'assets/characters/santa.webp',       w: 136, h: 150 },
  { id: 'char-snowman',     name: '雪だるま',         img: 'assets/characters/snowman.webp',     w: 123, h: 150 },
  { id: 'char-reindeer',    name: 'トナカイ',         img: 'assets/characters/reindeer.webp',    w: 104, h: 150 },
  { id: 'char-angel',       name: '天使',             img: 'assets/characters/angel.webp',       w: 137, h: 150 },
  { id: 'char-gnome',       name: 'ノーム',           img: 'assets/characters/gnome.webp',       w: 105, h: 150 },
  { id: 'char-gingerbread', name: 'ジンジャーブレッド', img: 'assets/characters/gingerbread.webp', w: 107, h: 125 },
  { id: 'char-nutcracker',  name: 'くるみ割り人形',   img: 'assets/characters/nutcracker.webp',  w: 76,  h: 150 },
  { id: 'char-polarbear',   name: 'シロクマ',         img: 'assets/characters/polarbear.webp',   w: 116, h: 150 },
  { id: 'char-robin',       name: 'ことり',           img: 'assets/characters/robin.webp',       w: 115, h: 90  },
];

PARTS_CATALOG.objects = [
  { id: 'obj-tree', name: 'クリスマスツリー', img: 'assets/objects/tree.webp', w: 207, h: 260 },
  { id: 'obj-church', name: '教会', img: 'assets/objects/church.webp', w: 214, h: 240 },
  { id: 'obj-pyramid', name: 'ピラミッド', img: 'assets/objects/pyramid.webp', w: 196, h: 240 },
  { id: 'obj-hutte', name: 'ヒュッテ', img: 'assets/objects/hutte.webp', w: 259, h: 200 },
  { id: 'obj-house', name: '木組みの家', img: 'assets/objects/house.webp', w: 222, h: 215 },
  { id: 'obj-carousel', name: 'メリーゴーラウンド', img: 'assets/objects/carousel.webp', w: 201, h: 215 },
];

PARTS_CATALOG.decorations = [
  { id: 'deco-ornament_red', name: '赤いオーナメント', img: 'assets/decorations/ornament_red.webp', w: 57, h: 70 },
  { id: 'deco-ornament_gold', name: '金のオーナメント', img: 'assets/decorations/ornament_gold.webp', w: 57, h: 70 },
  { id: 'deco-wreath', name: 'リース', img: 'assets/decorations/wreath.webp', w: 86, h: 80 },
  { id: 'deco-candle', name: 'キャンドル', img: 'assets/decorations/candle.webp', w: 64, h: 85 },
  { id: 'deco-star', name: '金の星', img: 'assets/decorations/star.webp', w: 71, h: 75 },
  { id: 'deco-stocking', name: '靴下', img: 'assets/decorations/stocking.webp', w: 64, h: 80 },
  { id: 'deco-candycane', name: 'キャンディケイン', img: 'assets/decorations/candycane.webp', w: 57, h: 85 },
  { id: 'deco-bell', name: 'ベル', img: 'assets/decorations/bell.webp', w: 69, h: 75 },
  { id: 'deco-holly', name: 'ヒイラギ', img: 'assets/decorations/holly.webp', w: 72, h: 60 },
  { id: 'deco-gift', name: 'プレゼント', img: 'assets/decorations/gift.webp', w: 77, h: 75 },
  { id: 'deco-mug', name: 'グリューワイン', img: 'assets/decorations/mug.webp', w: 62, h: 70 },
  { id: 'deco-lantern', name: 'ランタン', img: 'assets/decorations/lantern.webp', w: 53, h: 85 },
];

PARTS_CATALOG.backgrounds = [
  { id: 'bg-market',  name: 'マーケットの夜', img: 'assets/backgrounds/bg-market.webp' },
  { id: 'bg-oldtown', name: 'ドイツの旧市街', img: 'assets/backgrounds/bg-oldtown.webp' },
  { id: 'bg-night',   name: '夜の雪景色',     img: 'assets/backgrounds/bg-night.webp' },
  { id: 'bg-aurora',  name: '星空とオーロラ', img: 'assets/backgrounds/bg-aurora.webp' },
  { id: 'bg-dusk',    name: '夕暮れの雪原',   img: 'assets/backgrounds/bg-dusk.webp' },
  { id: 'bg-forest',  name: '冬の森',         img: 'assets/backgrounds/bg-forest.webp' },
];


// 追加コレクション：元の透過PNGを個別WebP化（画風別に分離）
PARTS_CATALOG.animals = [
  {
    "id": "an-fox",
    "name": "キツネ",
    "img": "assets/animals/an_fox.webp",
    "w": 136,
    "h": 145
  },
  {
    "id": "an-rabbit",
    "name": "白いウサギ",
    "img": "assets/animals/an_rabbit.webp",
    "w": 111,
    "h": 145
  },
  {
    "id": "an-owl",
    "name": "フクロウ",
    "img": "assets/animals/an_owl.webp",
    "w": 162,
    "h": 145
  },
  {
    "id": "an-squirrel",
    "name": "リス",
    "img": "assets/animals/an_squirrel.webp",
    "w": 159,
    "h": 145
  },
  {
    "id": "an-fawn",
    "name": "子ジカ",
    "img": "assets/animals/an_fawn.webp",
    "w": 100,
    "h": 145
  },
  {
    "id": "an-hedgehog",
    "name": "ハリネズミ",
    "img": "assets/animals/an_hedgehog.webp",
    "w": 116,
    "h": 145
  },
  {
    "id": "an-brown_bear",
    "name": "茶色いクマ",
    "img": "assets/animals/an_brown_bear.webp",
    "w": 140,
    "h": 145
  },
  {
    "id": "an-cat",
    "name": "ネコ",
    "img": "assets/animals/an_cat.webp",
    "w": 109,
    "h": 145
  },
  {
    "id": "an-dachshund",
    "name": "ダックスフント",
    "img": "assets/animals/an_dachshund.webp",
    "w": 147,
    "h": 145
  },
  {
    "id": "an-penguins",
    "name": "ペンギンの親子",
    "img": "assets/animals/an_penguins.webp",
    "w": 151,
    "h": 145
  },
  {
    "id": "an-alpaca",
    "name": "アルパカ",
    "img": "assets/animals/an_alpaca.webp",
    "w": 136,
    "h": 145
  },
  {
    "id": "an-long_tailed_tit",
    "name": "シマエナガ",
    "img": "assets/animals/an_long_tailed_tit.webp",
    "w": 130,
    "h": 145
  }
];
PARTS_CATALOG.porcelain = [
  {
    "id": "pc01-santa",
    "name": "サンタ",
    "img": "assets/porcelain/pc01_santa.webp",
    "w": 105,
    "h": 145
  },
  {
    "id": "pc01-snowman",
    "name": "雪だるま",
    "img": "assets/porcelain/pc01_snowman.webp",
    "w": 112,
    "h": 145
  },
  {
    "id": "pc01-reindeer",
    "name": "トナカイ",
    "img": "assets/porcelain/pc01_reindeer.webp",
    "w": 88,
    "h": 145
  },
  {
    "id": "pc01-angel",
    "name": "天使",
    "img": "assets/porcelain/pc01_angel.webp",
    "w": 114,
    "h": 145
  },
  {
    "id": "pc01-nutcracker",
    "name": "くるみ割り人形",
    "img": "assets/porcelain/pc01_nutcracker.webp",
    "w": 62,
    "h": 145
  },
  {
    "id": "pc01-fox",
    "name": "キツネ",
    "img": "assets/porcelain/pc01_fox.webp",
    "w": 101,
    "h": 145
  },
  {
    "id": "pc01-polar_bear",
    "name": "シロクマ",
    "img": "assets/porcelain/pc01_polar_bear.webp",
    "w": 119,
    "h": 145
  },
  {
    "id": "pc01-owl",
    "name": "フクロウ",
    "img": "assets/porcelain/pc01_owl.webp",
    "w": 97,
    "h": 145
  },
  {
    "id": "pc01-girl",
    "name": "コートの女の子",
    "img": "assets/porcelain/pc01_girl.webp",
    "w": 85,
    "h": 145
  },
  {
    "id": "pc02-choir_boy",
    "name": "聖歌隊の少年",
    "img": "assets/porcelain/pc02_choir_boy.webp",
    "w": 87,
    "h": 145
  },
  {
    "id": "pc02-muff_lady",
    "name": "マフを持つ婦人",
    "img": "assets/porcelain/pc02_muff_lady.webp",
    "w": 118,
    "h": 145
  },
  {
    "id": "pc02-skater",
    "name": "スケートの子ども",
    "img": "assets/porcelain/pc02_skater.webp",
    "w": 132,
    "h": 145
  },
  {
    "id": "pc02-horn_player",
    "name": "ホルン奏者",
    "img": "assets/porcelain/pc02_horn_player.webp",
    "w": 81,
    "h": 145
  },
  {
    "id": "pc02-chestnut_vendor",
    "name": "焼き栗売り",
    "img": "assets/porcelain/pc02_chestnut_vendor.webp",
    "w": 107,
    "h": 145
  },
  {
    "id": "pc02-night_watchman",
    "name": "ランタンの夜警",
    "img": "assets/porcelain/pc02_night_watchman.webp",
    "w": 106,
    "h": 145
  },
  {
    "id": "pc02-st_nicholas",
    "name": "聖ニコラウス",
    "img": "assets/porcelain/pc02_st_nicholas.webp",
    "w": 101,
    "h": 145
  },
  {
    "id": "pc02-dirndl_girl",
    "name": "ディアンドルの少女",
    "img": "assets/porcelain/pc02_dirndl_girl.webp",
    "w": 95,
    "h": 145
  },
  {
    "id": "pc02-shepherd_lamb",
    "name": "羊飼いと子羊",
    "img": "assets/porcelain/pc02_shepherd_lamb.webp",
    "w": 108,
    "h": 145
  },
  {
    "id": "pc02-wise_king",
    "name": "三賢者の王",
    "img": "assets/porcelain/pc02_wise_king.webp",
    "w": 110,
    "h": 145
  },
  {
    "id": "pc02-teddy_bear",
    "name": "テディベア",
    "img": "assets/porcelain/pc02_teddy_bear.webp",
    "w": 110,
    "h": 145
  },
  {
    "id": "pc02-coated_rabbit",
    "name": "コートのウサギ",
    "img": "assets/porcelain/pc02_coated_rabbit.webp",
    "w": 88,
    "h": 145
  },
  {
    "id": "pc03-fawn",
    "name": "子ジカ",
    "img": "assets/porcelain/pc03_fawn.webp",
    "w": 108,
    "h": 145
  },
  {
    "id": "pc03-fox",
    "name": "キツネ",
    "img": "assets/porcelain/pc03_fox.webp",
    "w": 122,
    "h": 145
  },
  {
    "id": "pc03-polar_bear",
    "name": "シロクマ",
    "img": "assets/porcelain/pc03_polar_bear.webp",
    "w": 157,
    "h": 145
  },
  {
    "id": "pc03-owl",
    "name": "フクロウ",
    "img": "assets/porcelain/pc03_owl.webp",
    "w": 124,
    "h": 145
  },
  {
    "id": "pc03-rabbit",
    "name": "白ウサギ",
    "img": "assets/porcelain/pc03_rabbit.webp",
    "w": 98,
    "h": 145
  },
  {
    "id": "pc03-squirrel",
    "name": "リス",
    "img": "assets/porcelain/pc03_squirrel.webp",
    "w": 119,
    "h": 145
  },
  {
    "id": "pc03-hedgehog",
    "name": "ハリネズミ",
    "img": "assets/porcelain/pc03_hedgehog.webp",
    "w": 130,
    "h": 145
  },
  {
    "id": "pc03-bear",
    "name": "クマ",
    "img": "assets/porcelain/pc03_bear.webp",
    "w": 123,
    "h": 145
  },
  {
    "id": "pc03-lamb",
    "name": "子羊",
    "img": "assets/porcelain/pc03_lamb.webp",
    "w": 120,
    "h": 145
  },
  {
    "id": "pc03-robin",
    "name": "コマドリ",
    "img": "assets/porcelain/pc03_robin.webp",
    "w": 119,
    "h": 145
  },
  {
    "id": "pc03-swan",
    "name": "白鳥",
    "img": "assets/porcelain/pc03_swan.webp",
    "w": 125,
    "h": 145
  },
  {
    "id": "pc03-dachshund",
    "name": "ダックスフント",
    "img": "assets/porcelain/pc03_dachshund.webp",
    "w": 143,
    "h": 145
  },
  {
    "id": "pc04-church",
    "name": "教会",
    "img": "assets/porcelain/pc04_church.webp",
    "w": 193,
    "h": 210
  },
  {
    "id": "pc04-hutte",
    "name": "ヒュッテ",
    "img": "assets/porcelain/pc04_hutte.webp",
    "w": 220,
    "h": 165
  },
  {
    "id": "pc04-half_timber",
    "name": "木組みの家",
    "img": "assets/porcelain/pc04_half_timber.webp",
    "w": 232,
    "h": 210
  },
  {
    "id": "pc04-chalet",
    "name": "山小屋",
    "img": "assets/porcelain/pc04_chalet.webp",
    "w": 270,
    "h": 210
  },
  {
    "id": "pc04-clock_tower",
    "name": "時計塔",
    "img": "assets/porcelain/pc04_clock_tower.webp",
    "w": 200,
    "h": 210
  },
  {
    "id": "pc04-carousel",
    "name": "メリーゴーラウンド",
    "img": "assets/porcelain/pc04_carousel.webp",
    "w": 209,
    "h": 210
  },
  {
    "id": "pc04-sleigh",
    "name": "そり",
    "img": "assets/porcelain/pc04_sleigh.webp",
    "w": 165,
    "h": 165
  },
  {
    "id": "pc04-train",
    "name": "汽車",
    "img": "assets/porcelain/pc04_train.webp",
    "w": 204,
    "h": 210
  },
  {
    "id": "pc04-rail_car",
    "name": "客車",
    "img": "assets/porcelain/pc04_rail_car.webp",
    "w": 161,
    "h": 165
  },
  {
    "id": "pc04-carriage",
    "name": "馬車",
    "img": "assets/porcelain/pc04_carriage.webp",
    "w": 216,
    "h": 210
  },
  {
    "id": "pc04-tram",
    "name": "路面電車",
    "img": "assets/porcelain/pc04_tram.webp",
    "w": 172,
    "h": 165
  },
  {
    "id": "pc04-market_cart",
    "name": "屋台カート",
    "img": "assets/porcelain/pc04_market_cart.webp",
    "w": 158,
    "h": 165
  },
  {
    "id": "pc05-christmas_tree",
    "name": "クリスマスツリー",
    "img": "assets/porcelain/pc05_christmas_tree.webp",
    "w": 110,
    "h": 120
  },
  {
    "id": "pc05-snow_fir",
    "name": "雪のモミの木",
    "img": "assets/porcelain/pc05_snow_fir.webp",
    "w": 105,
    "h": 120
  },
  {
    "id": "pc05-winter_tree",
    "name": "冬の木",
    "img": "assets/porcelain/pc05_winter_tree.webp",
    "w": 105,
    "h": 120
  },
  {
    "id": "pc05-wreath",
    "name": "リース",
    "img": "assets/porcelain/pc05_wreath.webp",
    "w": 146,
    "h": 120
  },
  {
    "id": "pc05-candle",
    "name": "キャンドル",
    "img": "assets/porcelain/pc05_candle.webp",
    "w": 103,
    "h": 120
  },
  {
    "id": "pc05-star",
    "name": "星",
    "img": "assets/porcelain/pc05_star.webp",
    "w": 100,
    "h": 120
  },
  {
    "id": "pc05-bell",
    "name": "ベル",
    "img": "assets/porcelain/pc05_bell.webp",
    "w": 77,
    "h": 120
  },
  {
    "id": "pc05-holly",
    "name": "ヒイラギ",
    "img": "assets/porcelain/pc05_holly.webp",
    "w": 105,
    "h": 120
  },
  {
    "id": "pc05-pinecone",
    "name": "松ぼっくり",
    "img": "assets/porcelain/pc05_pinecone.webp",
    "w": 108,
    "h": 120
  },
  {
    "id": "pc05-lantern",
    "name": "ランタン",
    "img": "assets/porcelain/pc05_lantern.webp",
    "w": 104,
    "h": 120
  },
  {
    "id": "pc05-poinsettia",
    "name": "ポインセチア",
    "img": "assets/porcelain/pc05_poinsettia.webp",
    "w": 120,
    "h": 120
  },
  {
    "id": "pc05-streetlight",
    "name": "街灯",
    "img": "assets/porcelain/pc05_streetlight.webp",
    "w": 95,
    "h": 120
  },
  {
    "id": "pc06-gingerbread_house",
    "name": "お菓子の家",
    "img": "assets/porcelain/pc06_gingerbread_house.webp",
    "w": 78,
    "h": 80
  },
  {
    "id": "pc06-lebkuchen",
    "name": "レープクーヘン",
    "img": "assets/porcelain/pc06_lebkuchen.webp",
    "w": 91,
    "h": 80
  },
  {
    "id": "pc06-stollen",
    "name": "シュトーレン",
    "img": "assets/porcelain/pc06_stollen.webp",
    "w": 98,
    "h": 80
  },
  {
    "id": "pc06-pretzel",
    "name": "プレッツェル",
    "img": "assets/porcelain/pc06_pretzel.webp",
    "w": 87,
    "h": 80
  },
  {
    "id": "pc06-mulled_wine",
    "name": "グリューワイン",
    "img": "assets/porcelain/pc06_mulled_wine.webp",
    "w": 69,
    "h": 80
  },
  {
    "id": "pc06-chestnuts",
    "name": "焼き栗",
    "img": "assets/porcelain/pc06_chestnuts.webp",
    "w": 59,
    "h": 80
  },
  {
    "id": "pc06-gift",
    "name": "プレゼント",
    "img": "assets/porcelain/pc06_gift.webp",
    "w": 69,
    "h": 80
  },
  {
    "id": "pc06-rocking_horse",
    "name": "木馬",
    "img": "assets/porcelain/pc06_rocking_horse.webp",
    "w": 77,
    "h": 80
  },
  {
    "id": "pc06-storybook",
    "name": "絵本",
    "img": "assets/porcelain/pc06_storybook.webp",
    "w": 73,
    "h": 80
  },
  {
    "id": "pc06-drum",
    "name": "太鼓",
    "img": "assets/porcelain/pc06_drum.webp",
    "w": 85,
    "h": 80
  },
  {
    "id": "pc06-basket",
    "name": "お菓子の籠",
    "img": "assets/porcelain/pc06_basket.webp",
    "w": 85,
    "h": 80
  },
  {
    "id": "pc06-teapot",
    "name": "ティーポット",
    "img": "assets/porcelain/pc06_teapot.webp",
    "w": 85,
    "h": 80
  }
];

// ───────── 東京クリスマスマーケット オリジナル ─────────
// hang: 天井から吊るす（drop = ひもの長さ）／ lift: 宙に浮かせる高さ ／ trueColor: 色調補正をかけない
// キャラクター：くしゅまる（クリスマスピラミッドの妖精）と、いつも一緒のピンクの妖精（名前未定）
// スタイルガイド 2026.10.13 より
PARTS_CATALOG.tcmChara = [
  { id: 'tcm-chara-wave',  name: 'くしゅまる',         trueColor: true, img: 'assets/tcm/chara_wave.webp',  w: 150, h: 149 },
  { id: 'tcm-chara-front', name: 'くしゅまる（正面）', trueColor: true, img: 'assets/tcm/chara_front.webp', w: 155, h: 152 },
  { id: 'tcm-chara-fly',   name: 'くしゅまる（とぶ）', trueColor: true, img: 'assets/tcm/chara_fly.webp',   w: 150, h: 140, lift: 0.5 },
  { id: 'tcm-chara-side',  name: 'くしゅまる（よこ）', trueColor: true, img: 'assets/tcm/chara_side.webp',  w: 100, h: 144 },
  { id: 'tcm-fairy',       name: 'ピンクの妖精',       trueColor: true, img: 'assets/tcm/fairy.webp',       w: 46,  h: 70, lift: 0.55 },
];
// 会場の名物（写真から切り抜き）＋マーケットらしいパーツ
PARTS_CATALOG.tcm = [
  { id: 'tcm-pyramid', name: 'TCMのピラミッド', trueColor: true, img: 'assets/tcm/pyramid.webp', w: 124, h: 336 },
  { id: 'tcm-star',    name: 'ヘルンフートの星', trueColor: true, img: 'assets/tcm/star.webp', w: 92, h: 90, hang: true, drop: 0.28 },
  { id: 'tcm-krippe',  name: 'クリッペ（降誕の飾り）', trueColor: true, img: 'assets/tcm/krippe.webp', w: 212, h: 160 },
  { id: 'tcm-mug-red',  name: '2026マグ（赤）', trueColor: true, img: 'assets/tcm/mug_red.webp',  w: 96, h: 82 },
  { id: 'tcm-mug-navy', name: '2026マグ（紺）', trueColor: true, img: 'assets/tcm/mug_navy.webp', w: 96, h: 85 },
  PARTS_CATALOG.objects.find((p) => p.id === 'obj-pyramid'),
  PARTS_CATALOG.objects.find((p) => p.id === 'obj-hutte'),
  PARTS_CATALOG.decorations.find((p) => p.id === 'deco-mug'),
  PARTS_CATALOG.objects.find((p) => p.id === 'obj-tree'),
].filter(Boolean);
// 2026マグカップに描かれたキャラクターたち（マグのデザインデータより）
const MUG = (id, name, w, h, extra = {}) => ({ id: 'mug-' + id, name, trueColor: true, img: `assets/tcm/mug/${id}.webp`, w, h, ...extra });
PARTS_CATALOG.tcmMug = [
  MUG('santa', 'サンタ', 92, 142), MUG('reindeer', 'トナカイ', 80, 147), MUG('snowman', '雪だるま', 84, 140),
  MUG('snowman_hat', 'シルクハットの雪だるま', 74, 147), MUG('gnome', 'ノーム', 66, 147), MUG('angel', '天使', 120, 101, { lift: 0.45 }),
  MUG('bird', '小鳥', 96, 82, { lift: 0.4 }), MUG('redhood', '赤ずきん', 110, 147), MUG('wolf', 'オオカミ', 96, 147),
  MUG('puss', '長ぐつをはいたネコ', 94, 147), MUG('snowwhite', '白雪姫', 107, 146), MUG('cinderella', 'シンデレラ', 109, 147),
  MUG('slipper', 'ガラスのくつ', 48, 43), MUG('deer_rider', 'トナカイに乗った小人', 114, 147),
  MUG('dwarf1', '小人1', 60, 91), MUG('dwarf2', '小人2', 66, 90), MUG('dwarf3', '小人3', 66, 90), MUG('dwarf4', '小人4', 66, 90),
  MUG('dwarf5', '小人5', 60, 90), MUG('dwarf6', '小人6', 60, 90), MUG('dwarf7', '小人7', 66, 90),
];
// アパマンショップ公式キャラクター（公式のぬいぐるみ写真で統一）
PARTS_CATALOG.apaman = [
  { id: 'apa-bear', name: 'べあ～君',   trueColor: true, img: 'assets/apaman/bear.webp', w: 112, h: 148 },
  { id: 'apa-hani', name: 'ハニちゃん', trueColor: true, img: 'assets/apaman/hani.webp', w: 106, h: 141 },
];
// 吊るすと自然なもの
['deco-ornament_red', 'deco-ornament_gold', 'deco-star', 'deco-bell', 'deco-wreath'].forEach((id) => {
  const d = PARTS_CATALOG.decorations.find((p) => p.id === id);
  if (d) Object.assign(d, { hang: true, drop: 0.22 });
});

// パーツSVGを色適用した状態で返す（画像パーツは <img>）
function renderPartSvg(part, color) {
  if (part.img) return `<img src="${part.img}" alt="${part.name || ''}" draggable="false">`;
  if (part.colorable && color) {
    return part.svg.replace(/\{\{PRIMARY\}\}/g, color);
  }
  return part.svg.replace(/\{\{PRIMARY\}\}/g, part.defaultColor || '#8b1821');
}

if (typeof module !== 'undefined') {
  module.exports = { PARTS_CATALOG, COLOR_PALETTE, BASE_THEMES, GLASS_THEMES };
}
