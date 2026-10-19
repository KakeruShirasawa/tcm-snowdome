// ============================================================
// スノードームメーカー（3D版）UI
// ============================================================
import { Globe, WATER_TINTS, GROUND_TYPES, OUTSIDES, drawSprite } from './globe3d.js';

const State = {
  shape: 'circle',
  baseTheme: 'walnut',
  glassTheme: 'gold',
  background: 'none',
  particle: 'snow',
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

// モジュール内の定数（ParticlePreview など）がすべて初期化されてから起動する
queueMicrotask(init);

function init() {
  globe = new Globe(document.getElementById('globeCanvas'), { onSelect: onPartSelected, onFlip: onFlipped });
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
  initFlipHint();
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
  const wrap = document.getElementById('particleGrid');
  wrap.innerHTML = '';
  const cards = [];
  PARTICLE_GROUPS.forEach(([g, jp, en]) => {
    const items = Object.entries(PARTICLE_PRESETS).filter(([, p]) => p.group === g);
    if (!items.length) return;
    const sec = document.createElement('div');
    sec.className = 'pgroup';
    sec.innerHTML = `<div class="pgroup-label">${jp}<span class="en">${en}</span></div><div class="pgrid"></div>`;
    const grid = sec.querySelector('.pgrid');
    items.forEach(([key, p]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'particle-card' + (key === State.particle ? ' selected' : '');
      b.dataset.key = key;
      b.setAttribute('aria-label', `${p.name}：${p.desc.replace('\n', '')}`);
      b.innerHTML = `<canvas class="pc-preview" width="160" height="120"></canvas><span class="pc-name">${p.name}</span><span class="pc-desc">${p.desc.replace('\n', '<br>')}</span>`;
      b.addEventListener('click', () => {
        wrap.querySelectorAll('.particle-card').forEach((o) => o.classList.toggle('selected', o === b));
        State.particle = key;
        globe.setParticle(key);
        shakeStage();
      });
      grid.appendChild(b);
      cards.push({ canvas: b.querySelector('canvas'), preset: p });
    });
    wrap.appendChild(sec);
  });
  ParticlePreview.start(wrap, cards);
}

// 降らせるものの「動きの見本」：カードの中で実際の動き方（沈む速さ・ひらひら・回転・きらめき）を再現
const ParticlePreview = (() => {
  const tinted = new Map();
  function sprite(kind, color) {
    const key = kind + color;
    if (tinted.has(key)) return tinted.get(key);
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const x = c.getContext('2d');
    drawSprite(x, kind, 48);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, 48, 48);
    tinted.set(key, c);
    return c;
  }
  function makeParticles(p, W, H) {
    const n = p.size[1] < 3 ? 46 : p.size[1] > 8 ? 13 : 24;
    const mult = p.shape === 'circle' || p.shape === 'flake' ? 3.2 : 4.2;
    return Array.from({ length: n }, () => {
      const r = Math.pow(Math.random(), 1.8);
      return {
        x: Math.random() * W, y: Math.random() * H, r: (p.size[0] + r * (p.size[1] - p.size[0])) * mult,
        v: (0.55 + r * 0.7 + Math.random() * 0.35), w: 0.6 + Math.random() * 1.5, amp: 0.4 + Math.random() * 0.9,
        ph: Math.random() * 6.28, spin: (p.spin || 0) * (0.5 + Math.random()) * (Math.random() < 0.5 ? -1 : 1),
        img: sprite(p.shape, p.colors[(Math.random() * p.colors.length) | 0]), a: 0.62 + Math.random() * 0.38,
      };
    });
  }
  function draw(card, t, dt) {
    const { canvas: cv, preset: p } = card;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    if (!card.ps) card.ps = makeParticles(p, W, H);
    const bg = ctx.createRadialGradient(W / 2, H * 0.35, 4, W / 2, H / 2, W * 0.75);
    bg.addColorStop(0, '#24365f'); bg.addColorStop(1, '#070d22');
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
    const fall = p.fall * 300, flut = (p.flutter || 0) * 9;
    card.ps.forEach((q) => {
      q.y += fall * q.v * dt;
      const sx = Math.sin(t * q.w + q.ph) * flut * q.amp;
      if (fall > 0 && q.y > H + q.r) { q.y = -q.r; q.x = Math.random() * W; }
      if (fall < 0 && q.y < -q.r) { q.y = H + q.r; q.x = Math.random() * W; }
      const ang = q.ph + q.spin * t;
      const sq = 1 - (p.tumble || 0) * (1 - Math.max(0.16, Math.abs(Math.cos(ang * 0.83 + q.ph * 1.7))));
      const fl = (p.flash || 0) * Math.pow(Math.abs(Math.cos(ang * 1.27 + q.ph)), 18);
      const size = q.r * (1 + fl * 0.7);
      ctx.save();
      ctx.translate(q.x + sx, q.y); ctx.rotate(ang); ctx.scale(1, sq);
      ctx.globalAlpha = Math.min(1, q.a * (0.55 + 0.45 * sq));
      ctx.drawImage(q.img, -size / 2, -size / 2, size, size);
      if (fl > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fl; ctx.drawImage(q.img, -size / 2, -size / 2, size, size); ctx.drawImage(q.img, -size / 2, -size / 2, size, size); ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over'; }
      ctx.restore();
    });
  }
  return {
    start(wrap, cards) {
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        // 見えている時だけ描く
        if (wrap.offsetParent !== null && !document.hidden) cards.forEach((c) => draw(c, now / 1000, dt));
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
  };
})();

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

// ───────── 仕上げ（雪面・水・飾る場所・刻印・オルゴール） ─────────
function swatchRow(id, entries, current, swatchCss, onPick) {
  optionList(id, entries, current,
    { cls: 'theme-option', html: (t) => `<span class="swatch" style="${swatchCss(t)}"></span><span class="name">${t.name}</span>` }, onPick);
}

function initFinishing() {
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

// 逆さまにできたら、ステージ上の操作ヒントを消す（次回以降も出さない）
function onFlipped(down) {
  if (down) {
    document.getElementById('flipHint')?.classList.add('done');
    try { localStorage.setItem('tcm_snowdome_flipped', '1'); } catch (e) {}
    globe.select(null);
  }
}

function initFlipHint() {
  const h = document.getElementById('flipHint');
  if (!h) return;
  let seen = false;
  try { seen = localStorage.getItem('tcm_snowdome_flipped') === '1'; } catch (e) {}
  if (seen) h.classList.add('done');
  else setTimeout(() => h.classList.add('show'), 1200);
  // マウス環境は表記を変える
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) h.querySelector('.fh-text').innerHTML = '左右にドラッグで<b>逆さま</b>に';
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
