// ドームの形（3D）。形状そのものは js/globe3d.js の buildShape() で生成
const ico = (d) => `<svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${d}</svg>`;

const GLOBE_SHAPES = {
  circle: { name: '丸',       icon: ico('<circle cx="16" cy="14" r="10"/><path d="M8 23h16l2 5H6z"/>') },
  oval:   { name: 'オーバル', icon: ico('<ellipse cx="16" cy="13" rx="7.5" ry="11"/><path d="M10 23h12l2 5H8z"/>') },
  bell:   { name: 'ベルジャー', icon: ico('<path d="M9 23V12a7 7 0 0 1 14 0v11"/><path d="M7 23h18l1 5H6z"/>') },
  cube:   { name: 'キューブ', icon: ico('<rect x="7" y="4" width="18" height="19" rx="2"/><path d="M5 23h22v5H5z"/>') },
  heart:  { name: 'ハート',   icon: ico('<path d="M16 23C9 18 5 14 5 9.5A5 5 0 0 1 16 7a5 5 0 0 1 11 2.5C27 14 23 18 16 23z"/><path d="M10 24h12v4H10z"/>') },
  star:   { name: 'スター',   icon: ico('<path d="M16 3l3.2 7 7.6.8-5.7 5.1 1.6 7.5L16 19.6l-6.7 3.8 1.6-7.5-5.7-5.1 7.6-.8z"/><path d="M10 24h12v4H10z"/>') },
};
