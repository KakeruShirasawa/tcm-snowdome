// ============================================================
// スノードームメーカー（3D版）UI
// ============================================================
import { Globe, PART_STYLES, WATER_TINTS, GROUND_TYPES, OUTSIDES } from './globe3d.js';

const State = {
  shape: 'circle',
  baseTheme: 'walnut',
  glassTheme: 'gold',
  background: 'none',
  particle: 'snow',
  style: 'painted',
  ground: 'snow',
  water: 'clear',
  outside: 'studio',
};

// パーツのカテゴリ（画像が入っているものだけ表示）
const PART_CATEGORIES = [
  ['characters', 'キャラ'], ['porcelain', '磁器コレクション'], ['animals', 'どうぶつ'], ['people', 'ひと'], ['objects', 'オブジェ'],
  ['buildings', '街と乗り物'], ['nature', '木と自然'], ['food', '食べもの'], ['toys', '雑貨・おもちゃ'], ['decorations', 'デコ'],
];

let globe;

init();

function init() {
  globe = new Globe(document.getElementById('globeCanvas'), { onSelect: onPartSelected });
  window.globe = globe; // デバッグ・書き出し用
  window.exportToPNG = async () => globe.exportPNG(1200);

  initShapeSelector();
  initBaseThemes();
  initGlassThemes();
  initBackgroundPanel();
  initParticlePanel();
  initParticleAmount();
  initPartsPanel();
  initStepTabs();
  initFinishing();
  initToolbar();
  initStage();
  initActions();

  if (State.background === 'none') globe.setBackground({ none: true });
  else setBackground(PARTS_CATALOG.backgrounds.find((b) => b.id === State.background));
  document.body.classList.add('globe-ready');
}

// ───────── 選択肢パネル ─────────
function optionList(wrapId, entries, current, render, onPick) {
  const wrap = document.getElementById(wrapId);
  wrap.innerHTML = '';
  entries.forEach(([key, item]) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = render.cls + (key === current ? ' selected' : '');
    el.dataset.key = key;
    el.innerHTML = render.html(item);
    el.addEventListener('click', () => {
      wrap.querySelectorAll('[data-key]').forEach((o) => o.classList.toggle('selected', o.dataset.key === key));
      onPick(key);
    });
    wrap.appendChild(el);
  });
}

function initShapeSelector() {
  optionList('shapeSelector', Object.entries(GLOBE_SHAPES), State.shape,
    { cls: 'shape-option', html: (s) => `<span class="icon">${s.icon}</span><span class="name">${s.name}</span>` },
    (key) => { State.shape = key; globe.setShape(key); });
}

function initBaseThemes() {
  optionList('baseThemes', Object.entries(BASE_THEMES), State.baseTheme,
    { cls: 'theme-option', html: (t) => `<span class="swatch" style="background:linear-gradient(135deg, ${t.stops[0][0]}, ${t.stops[1][0]}, ${t.stops[2][0]});"></span><span class="name">${t.name}</span>` },
    (key) => { State.baseTheme = key; globe.setBaseTheme(key); });
}

function initGlassThemes() {
  optionList('glassThemes', Object.entries(GLASS_THEMES), State.glassTheme,
    { cls: 'theme-option', html: (t) => `<span class="swatch" style="background:${t.stroke};"></span><span class="name">${t.name}</span>` },
    (key) => { State.glassTheme = key; globe.setRimTheme(key); });
}

function setBackground(bg) {
  if (!bg) return;
  if (bg.none) { globe.setBackground({ none: true }); return; }
  globe.setBackground(bg.img ? { src: bg.img } : { svg: bg.svg });
}

function initBackgroundPanel() {
  const grid = document.getElementById('bgPresets');
  grid.innerHTML = '';
  const none = document.createElement('button');
  none.type = 'button';
  none.className = 'bg-preset bg-none' + (State.background === 'none' ? ' selected' : '');
  none.dataset.bg = 'none';
  none.innerHTML = '<div class="thumb"><span>透明</span></div><div class="label">背景なし</div>';
  none.addEventListener('click', () => {
    State.background = 'none';
    grid.querySelectorAll('.bg-preset').forEach((o) => o.classList.toggle('selected', o === none));
    globe.setBackground({ none: true });
  });
  grid.appendChild(none);
  PARTS_CATALOG.backgrounds.forEach((bg) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'bg-preset' + (bg.id === State.background ? ' selected' : '');
    el.dataset.bg = bg.id;
    el.innerHTML = `<div class="thumb">${bg.img ? `<img src="${bg.img}" alt="">` : bg.svg}</div><div class="label">${bg.name}</div>`;
    el.addEventListener('click', () => {
      State.background = bg.id;
      grid.querySelectorAll('.bg-preset').forEach((o) => o.classList.toggle('selected', o.dataset.bg === bg.id));
      setBackground(bg);
    });
    grid.appendChild(el);
  });

  document.getElementById('bgUploadInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('画像ファイルを選んでください'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      State.background = 'custom';
      grid.querySelectorAll('.bg-preset').forEach((o) => o.classList.remove('selected'));
      globe.setBackground({ src: ev.target.result }).then(() => showToast('背景を設定しました'));
    };
    reader.readAsDataURL(file);
  });
}

function initParticleAmount() {
  const r = document.getElementById('particleAmount');
  const out = document.getElementById('particleAmountLabel');
  const label = (v) => (v < 4000 ? 'ちらちら' : v < 9000 ? 'ふんわり' : v < 17000 ? 'たっぷり' : '吹雪');
  const apply = () => { globe.setParticleAmount(+r.value); out.textContent = label(+r.value); };
  r.addEventListener('input', apply);
  apply();
}

function initParticlePanel() {
  optionList('particleGrid', Object.entries(PARTICLE_PRESETS), State.particle,
    { cls: 'particle-option', html: (p) => `<span class="icon">${p.icon}</span><span class="name">${p.name}</span>` },
    (key) => { State.particle = key; globe.setParticle(key); shakeStage(); });
}

// ───────── パーツ ─────────
function initPartsPanel() {
  const wrap = document.getElementById('partCats');
  wrap.innerHTML = '';
  PART_CATEGORIES.filter(([k]) => (PARTS_CATALOG[k] || []).length).forEach(([k, label], i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat-chip' + (i === 0 ? ' active' : '');
    b.dataset.cat = k;
    b.innerHTML = `${label}<span class="n">${PARTS_CATALOG[k].length}</span>`;
    b.addEventListener('click', () => {
      wrap.querySelectorAll('.cat-chip').forEach((x) => x.classList.toggle('active', x === b));
      renderPartsGrid(k);
    });
    wrap.appendChild(b);
  });
  renderPartsGrid('characters');
}

function initStepTabs() {
  const tabs = document.querySelectorAll('.step-tab');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.toggle('active', x === t));
    document.querySelectorAll('.step-pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === t.dataset.step));
  }));
}

// ───────── 仕上げ（タッチ・雪面・水・飾る場所・刻印・オルゴール） ─────────
function swatchRow(id, entries, current, swatchCss, onPick) {
  optionList(id, entries, current,
    { cls: 'theme-option', html: (t) => `<span class="swatch" style="${swatchCss(t)}"></span><span class="name">${t.name}</span>` }, onPick);
}

function initFinishing() {
  optionList('styleSelector', Object.entries(PART_STYLES), State.style,
    { cls: 'style-option', html: (t) => `<span class="name">${t.name}</span>` },
    (k) => { State.style = k; globe.setPartStyle(k); });

  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  swatchRow('groundSelector', Object.entries(GROUND_TYPES), State.ground,
    (t) => `background: radial-gradient(circle at 35% 30%, #fff, ${hex(t.color)} 60%, ${t.metalness > 0.3 ? '#8a6a3a' : hex(t.color)});`,
    (k) => { State.ground = k; globe.setGround(k); });
  swatchRow('waterSelector', Object.entries(WATER_TINTS), State.water,
    (t) => t.color ? `background: linear-gradient(160deg, #fff, ${hex(t.color)});` : 'background: repeating-linear-gradient(45deg,#fff 0 4px,#e8eef5 4px 8px);',
    (k) => { State.water = k; globe.setWater(k); });
  const outsideCss = { studio: 'background: radial-gradient(circle at 50% 35%, #5a4e44, #0b0908);', navy: 'background: radial-gradient(circle at 50% 35%, #22346a, #060c22);', bokeh: 'background: radial-gradient(circle at 30% 30%, #ffc46e 0 18%, transparent 19%), radial-gradient(circle at 70% 60%, #ffe1a0 0 14%, transparent 15%), #1a1428;', window: 'background: linear-gradient(90deg, transparent 46%, #3a2a1a 46% 54%, transparent 54%), linear-gradient(#c8d8ee, #7f97bf);' };
  swatchRow('outsideSelector', Object.entries(OUTSIDES), State.outside, (t) => outsideCss[Object.keys(OUTSIDES).find((k) => OUTSIDES[k] === t)],
    (k) => { State.outside = k; globe.setOutside(k); });

  // 刻印
  const nm = document.getElementById('engName'), msg = document.getElementById('engMsg');
  let timer;
  const apply = () => { clearTimeout(timer); timer = setTimeout(() => globe.setEngraving({ name: nm.value, message: msg.value }), 250); };
  nm.addEventListener('input', apply); msg.addEventListener('input', apply);

  // オルゴール
  const mb = document.getElementById('musicBoxBtn');
  mb.addEventListener('click', () => {
    const on = mb.getAttribute('aria-pressed') !== 'true';
    mb.setAttribute('aria-pressed', String(on));
    mb.classList.toggle('active', on);
    mb.querySelector('.lbl').textContent = on ? 'オルゴールを止める' : 'オルゴールを鳴らす';
    globe.setMusicBox(on);
    if (on) MusicBox.play(); else MusicBox.stop();
  });
}

// オルゴールの音（きよしこの夜／1818年・パブリックドメイン）を WebAudio で鳴らす
const MusicBox = (() => {
  let ctx, timer, playing = false;
  const N = { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46 };
  const tune = [['G4',3],['A4',1],['G4',2],['E4',6],['G4',3],['A4',1],['G4',2],['E4',6],['D5',4],['D5',2],['B4',6],['C5',4],['C5',2],['G4',6],
    ['A4',4],['A4',2],['C5',3],['B4',1],['A4',2],['G4',3],['A4',1],['G4',2],['E4',6],['A4',4],['A4',2],['C5',3],['B4',1],['A4',2],['G4',3],['A4',1],['G4',2],['E4',6],
    ['D5',4],['D5',2],['F5',3],['D5',1],['B4',2],['C5',6],['E5',6],['C5',3],['G4',1],['E4',2],['G4',3],['F4',1],['D4',2],['C4',12]];
  const beat = 0.3;
  function pling(f, t, dur) {
    const out = ctx.createGain(); out.connect(ctx.destination);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.22, t + 0.008); out.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(1.2, dur * 1.5));
    [[1, 1], [2, 0.35], [4.2, 0.12]].forEach(([m, g]) => {
      const o = ctx.createOscillator(); const gg = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * 2 * m; gg.gain.value = g;
      o.connect(gg); gg.connect(out); o.start(t); o.stop(t + Math.max(1.3, dur * 1.6));
    });
  }
  function loop() {
    if (!playing) return;
    let t = ctx.currentTime + 0.1;
    tune.forEach(([n, d]) => { pling(N[n], t, d * beat); t += d * beat; });
    const total = tune.reduce((a, [, d]) => a + d, 0) * beat;
    timer = setTimeout(loop, (total + 1.5) * 1000);
  }
  return {
    play() { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); if (playing) return; playing = true; loop(); },
    stop() { playing = false; clearTimeout(timer); if (ctx) { ctx.close(); ctx = null; } },
  };
})();

function renderPartsGrid(cat) {
  const grid = document.getElementById('partsGrid');
  grid.innerHTML = '';
  (PARTS_CATALOG[cat] || []).forEach((p) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'part-tile';
    el.innerHTML = `<div class="thumb">${renderPartSvg(p, p.defaultColor)}</div><div class="label">${p.name}</div>`;
    el.addEventListener('click', async () => {
      el.disabled = true;
      await globe.addPart(p);
      el.disabled = false;
      if (window.matchMedia('(max-width: 960px)').matches) {
        document.getElementById('stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    grid.appendChild(el);
  });
}

// ───────── 選択中パーツのツールバー ─────────
function onPartSelected(part) {
  const bar = document.getElementById('partToolbar');
  if (!part) { bar.classList.remove('show'); return; }
  document.getElementById('ptName').textContent = part.cat.name;
  const colors = document.getElementById('ptColors');
  colors.innerHTML = '';
  if (part.cat.colorable && !part.cat.img) {
    COLOR_PALETTE.forEach((c) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'color-chip' + (c.hex === part.color ? ' selected' : '');
      chip.style.background = c.hex;
      chip.title = c.name;
      chip.addEventListener('click', async () => {
        await globe.recolorPart(part.id, c.hex);
        colors.querySelectorAll('.color-chip').forEach((x) => x.classList.toggle('selected', x === chip));
      });
      colors.appendChild(chip);
    });
  }
  colors.style.display = colors.children.length ? '' : 'none';
  bar.classList.add('show');
}

function initToolbar() {
  const acts = {
    rotL: { rotY: -Math.PI / 8 }, rotR: { rotY: Math.PI / 8 },
    smaller: { scale: 1 / 1.12 }, bigger: { scale: 1.12 },
    down: { lift: -0.08 }, up: { lift: 0.08 },
    flip: { flip: true },
  };
  document.querySelectorAll('#partToolbar [data-act]').forEach((b) => {
    let timer;
    const run = () => {
      const id = globe.selectedId;
      if (!id) return;
      if (b.dataset.act === 'delete') { globe.removePart(id); return; }
      globe.updatePart(id, acts[b.dataset.act]);
    };
    // 長押しで連続操作（フリップ・削除以外）
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      run();
      if (['flip', 'delete'].includes(b.dataset.act)) return;
      timer = setTimeout(function rep() { run(); timer = setTimeout(rep, 90); }, 380);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => clearTimeout(timer)));
  });
  document.getElementById('ptClose').addEventListener('click', () => globe.select(null));
}

// ───────── ステージ ─────────
function initStage() {
  document.getElementById('shakeBtn').addEventListener('click', shakeStage);
  // iPhone は動きセンサーの許可が必要（最初のボタン操作時に1回だけ聞く）
  const askMotion = () => {
    [window.DeviceMotionEvent, window.DeviceOrientationEvent].forEach((E) => {
      if (E && typeof E.requestPermission === 'function') E.requestPermission().catch(() => {});
    });
  };
  document.getElementById('shakeBtn').addEventListener('click', askMotion, { once: true });
  document.getElementById('globeCanvas').addEventListener('pointerdown', askMotion, { once: true });
  // スマホ自体を逆さまにしたら、ドームも逆さまに（戻したら元に）
  let lastFlip = 0, byDevice = false;
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta == null || Date.now() - lastFlip < 900) return;
    if (e.beta < -55 && !globe.upsideDown) { lastFlip = Date.now(); byDevice = true; flipStage(true); }
    else if (e.beta > 35 && globe.upsideDown && byDevice) { lastFlip = Date.now(); byDevice = false; flipStage(false); }
  });
  if (window.DeviceMotionEvent) {
    let last = 0;
    window.addEventListener('devicemotion', (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      if (Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z) > 25 && Date.now() - last > 1000) {
        last = Date.now();
        shakeStage();
      }
    });
  }
}

function flipStage(force) {
  const down = globe.flip(force);
  if (down) globe.select(null);
}

function shakeStage() {
  globe.shake();
  const btn = document.getElementById('shakeBtn');
  btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse');
}

// ───────── アクション ─────────
function initActions() {
  document.getElementById('btnDownload').addEventListener('click', () => {
    try {
      downloadDataUrl(globe.exportPNG(1200), 'tcm-snowdome.png');
      showToast('ダウンロードしました');
    } catch (e) {
      console.error(e);
      showToast('書き出しに失敗しました');
    }
  });
  document.getElementById('btnShareX').addEventListener('click', shareToX);
  document.getElementById('btnShareLine').addEventListener('click', shareToLine);
  document.getElementById('btnPostContest').addEventListener('click', openContestModal);
  document.getElementById('btnReset').addEventListener('click', () => {
    if (confirm('置いたパーツをすべて外しますか？')) globe.clearParts();
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
}
window.showToast = showToast;
