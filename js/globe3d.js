// ============================================================
// 3D スノードーム エンジン（three.js）
// ガラス / 台座 / 雪の地面 / 背景 / パーツ / 降り積もる粒子
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const UNIT = 1 / 300;          // カタログの寸法（px）→ ワールド単位
const PARTICLE_MAX = 24000;     // 確保する最大数
const PARTICLE_DEFAULT = 14000; // 初期の量（振るとパーツが隠れるくらい）
// 積雪：落ちた場所が盛り上がる高さマップ
const SNOW_GRID = 56;            // 高さマップの細かさ
const SNOW_TARGET_DEPTH = 0.06;  // 標準の量で積もったときの平均の深さ
const SNOW_MAX_DEPTH = 0.13;     // 積もりすぎの上限

// ───────── 形状 ─────────
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polyIntervalsAtY(poly, y) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  xs.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(-0.15, -0.85, -1.0, -0.35, -1.0, 0.2);
  s.bezierCurveTo(-1.0, 0.78, -0.42, 1.02, 0, 0.6);
  s.bezierCurveTo(0.42, 1.02, 1.0, 0.78, 1.0, 0.2);
  s.bezierCurveTo(1.0, -0.35, 0.15, -0.85, 0, -1);
  return s;
}

function starShape() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : 0.5;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function buildShape(key) {
  const spec = { key };

  if (key === 'circle' || key === 'oval') {
    const sx = key === 'oval' ? 0.82 : 1, sy = key === 'oval' ? 1.1 : 1;
    const g = new THREE.SphereGeometry(1, 96, 64);
    g.scale(sx, sy, sx);
    spec.geo = g;
    spec.groundY = key === 'oval' ? -0.5 : -0.42;
    spec.seatY = key === 'oval' ? -0.82 : -0.72;
    spec.topY = sy;
    spec.halfW = sx;
    spec.radiusAt = (y) => { const t = 1 - (y / sy) ** 2; return t > 0 ? sx * Math.sqrt(t) : 0; };
    spec.inside = (x, y, z) => (x / sx) ** 2 + (y / sy) ** 2 + (z / sx) ** 2 < 0.9;
    spec.base = 'round';
  } else if (key === 'bell') {
    const R = 0.8, yBot = -1.0, yS = 0.2, yTop = 1.0;
    const pts = [new THREE.Vector2(R, yBot), new THREE.Vector2(R, yS)];
    for (let i = 1; i <= 24; i++) {
      const t = (i / 24) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.max(0.0001, R * Math.cos(t)), yS + (yTop - yS) * Math.sin(t)));
    }
    spec.geo = new THREE.LatheGeometry(pts, 96);
    spec.groundY = -0.55;
    spec.seatY = -0.9;
    spec.topY = yTop;
    spec.halfW = R;
    spec.radiusAt = (y) => (y <= yS ? R : R * Math.sqrt(Math.max(0, 1 - ((y - yS) / (yTop - yS)) ** 2)));
    spec.inside = (x, y, z) => y > yBot && y < yTop - 0.06 && Math.hypot(x, z) < spec.radiusAt(y) * 0.92;
    spec.base = 'round';
  } else if (key === 'cube') {
    const g = new RoundedBoxGeometry(1.6, 1.8, 1.6, 6, 0.14);
    g.translate(0, 0.05, 0);
    spec.geo = g;
    spec.groundY = -0.48;
    spec.seatY = -0.8;
    spec.topY = 0.95;
    spec.halfW = 0.8;
    spec.inside = (x, y, z) => Math.abs(x) < 0.72 && Math.abs(z) < 0.72 && y > -0.85 && y < 0.86;
    spec.base = 'box';
    spec.backdropZ = -0.6;
    spec.baseW = 1.95; spec.baseD = 1.95;
    spec.capGeo = () => new THREE.PlaneGeometry(1.56, 1.56).rotateX(-Math.PI / 2);
    spec.onFloor = (x, z) => Math.abs(x) <= 0.78 && Math.abs(z) <= 0.78;
  } else {
    // ハート / スター（押し出し）
    const shape = key === 'heart' ? heartShape() : starShape();
    const raw = shape.getPoints(64);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    raw.forEach((p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const s = 1.95 / (maxY - minY);
    const depth = key === 'heart' ? 1.0 : 0.95;
    const bevel = 0.1;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: depth / s - (2 * bevel) / s, bevelEnabled: true,
      bevelThickness: bevel / s, bevelSize: bevel / s, bevelSegments: 6, curveSegments: 48,
    });
    const g2 = smoothSides(g);
    g.dispose();
    g2.center();
    g2.scale(s, s, s);
    g2.computeBoundingBox();
    const dy = 1.0 - g2.boundingBox.max.y;
    g2.translate(0, dy, 0);
    g2.computeBoundingBox();
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const poly = raw.map((p) => new THREE.Vector2((p.x - cx) * s, (p.y - cy) * s + 0 ));
    // g.center() は bevel 込みの中心。ずれ補正
    const pb = { minY: Infinity, maxY: -Infinity };
    poly.forEach((p) => { pb.minY = Math.min(pb.minY, p.y); pb.maxY = Math.max(pb.maxY, p.y); });
    const polyShift = (g2.boundingBox.max.y - bevel) - pb.maxY;
    poly.forEach((p) => { p.y += polyShift; });
    const shrink = (k) => poly.map((p) => new THREE.Vector2(p.x * k, (p.y - 0.0) * k + (1 - k) * 0.0));
    const inner = shrink(0.86);
    spec.geo = g2;
    spec.poly = poly;
    spec.depth = depth;
    spec.backdropZ = -depth * 0.36;
    spec.groundY = key === 'heart' ? -0.32 : -0.2;
    spec.seatY = key === 'heart' ? -0.62 : -0.5;
    spec.topY = 1.0;
    spec.halfW = (maxX - minX) * s / 2 + bevel;
    spec.inside = (x, y, z) => Math.abs(z) < depth * 0.36 && pointInPoly(x, y, inner);
    spec.base = 'box';
    const below = poly.filter((p) => p.y <= spec.seatY);
    const sx0 = Math.min(...below.map((p) => p.x)), sx1 = Math.max(...below.map((p) => p.x));
    spec.baseW = Math.max(0.9, sx1 - sx0 + 0.4);
    spec.baseH = (spec.seatY - Math.min(...poly.map((p) => p.y))) + 0.3;
    spec.baseD = depth + 0.35;
    const capSpans = polyIntervalsAtY(shrink(0.97), spec.groundY);
    spec.onFloor = (x, z) => Math.abs(z) <= depth * 0.46 && capSpans.some(([a, b]) => x >= a && x <= b);
    spec.capGeo = () => {
      const geos = polyIntervalsAtY(shrink(0.97), spec.groundY).map(([a, b]) => {
        const pg = new THREE.PlaneGeometry(b - a, depth * 0.92).rotateX(-Math.PI / 2);
        pg.translate((a + b) / 2, 0, 0);
        return pg;
      });
      return mergeGeos(geos);
    };
  }

  if (spec.base === 'round') {
    spec.seatR = spec.radiusAt(spec.seatY);
    spec.onFloor = (x, z) => Math.hypot(x, z) <= spec.radiusAt(spec.groundY) * 0.985;
    spec.capGeo = () => {
      const r = spec.radiusAt(spec.groundY) * 0.985;
      const cg = new THREE.CircleGeometry(r, 72, 0, Math.PI * 2);
      cg.rotateX(-Math.PI / 2);
      // 中央を少し盛り上げて雪らしく
      const pos = cg.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const d = Math.hypot(x, z) / r;
        pos.setY(i, (1 - d * d) * 0.05 + Math.sin(x * 9) * Math.cos(z * 7) * 0.008 * (1 - d));
      }
      cg.computeVertexNormals();
      return cg;
    };
  }
  return spec;
}

// 押し出し形状：前後の面は平らな法線のまま、側面（ベベル含む）だけなめらかにする
function smoothSides(g) {
  const pos = g.attributes.position;
  const slice = (grp) => {
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos.array.slice(grp.start * 3, (grp.start + grp.count) * 3), 3));
    return out;
  };
  const caps = slice(g.groups[0]);
  caps.computeVertexNormals();
  let sides = mergeVertices(slice(g.groups[1]), 1e-4);
  sides.computeVertexNormals();
  sides = sides.toNonIndexed();
  const P = new Float32Array(caps.attributes.position.count * 3 + sides.attributes.position.count * 3);
  const N = new Float32Array(P.length);
  P.set(caps.attributes.position.array, 0); P.set(sides.attributes.position.array, caps.attributes.position.array.length);
  N.set(caps.attributes.normal.array, 0); N.set(sides.attributes.normal.array, caps.attributes.normal.array.length);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return out;
}

function mergeGeos(geos) {
  if (geos.length === 1) return geos[0];
  const positions = [], normals = [], uvs = [], index = [];
  let offset = 0;
  geos.forEach((g) => {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { positions.push(p.getX(i), p.getY(i), p.getZ(i)); normals.push(n.getX(i), n.getY(i), n.getZ(i)); uvs.push(u.getX(i), u.getY(i)); }
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i++) index.push(idx[i] + offset);
    offset += p.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(index);
  return out;
}

// 形状の「奥側の内面」を背景スクリーンとして切り出す（正面からの平面投影UV）
function backdropGeometry(spec) {
  const src = spec.geo.index ? spec.geo.toNonIndexed() : spec.geo.clone();
  const p = src.attributes.position;
  const pos = [], uv = [];
  const k = 0.975;
  const top = spec.topY, gy = spec.groundY;
  for (let i = 0; i < p.count; i += 3) {
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    if (cz > (spec.backdropZ ?? 0.02)) continue;
    for (let j = 0; j < 3; j++) {
      const x = p.getX(i + j) * k, y = p.getY(i + j) * k, z = p.getZ(i + j) * k;
      pos.push(x, y, z);
      uv.push(0.5 + x / (2 * spec.halfW), 0.3 + ((y - gy) / (top - gy)) * 0.7);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// ───────── 素材（テクスチャ） ─────────
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function woodTexture(base, dark) {
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = dark; ctx.globalAlpha = 0.08 + Math.random() * 0.15;
      ctx.lineWidth = 1 + Math.random() * 3;
      const y = Math.random() * h;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 4);
      ctx.stroke();
    }
  });
}

function walnutTexture() {
  return canvasTex(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3b2416'); g.addColorStop(0.5, '#4a2d1b'); g.addColorStop(1, '#2e1b10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * h, amp = 2 + Math.random() * 6, f = 0.004 + Math.random() * 0.01;
      ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(20,10,4,0.35)' : 'rgba(120,78,46,0.18)';
      ctx.lineWidth = 0.5 + Math.random() * 1.6;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * f + i) * amp);
      ctx.stroke();
    }
  });
}

function marbleTexture() {
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#efe9df'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = i % 3 ? '#b9b0a2' : '#c9a66b'; ctx.globalAlpha = 0.25 + Math.random() * 0.3;
      ctx.lineWidth = 0.6 + Math.random() * 1.6;
      let x = Math.random() * w, y = 0;
      ctx.beginPath(); ctx.moveTo(x, y);
      while (y < h) { x += (Math.random() - 0.5) * 40; y += 12 + Math.random() * 20; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
}

function plaqueTexture({ name = '', message = '', edition = '' } = {}) {
  // 真鍮の銘板に彫り込み文字
  return canvasTex(1024, 160, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#8a6a32'); g.addColorStop(0.35, '#d9b874'); g.addColorStop(0.55, '#f2dca0'); g.addColorStop(0.8, '#b8914c'); g.addColorStop(1, '#7c5c28');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; ctx.fillRect(0, Math.random() * h, w, 1); } // ヘアライン
    ctx.strokeStyle = 'rgba(70,45,15,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(18, 18, w - 36, h - 36);
    const engrave = (text, font, x, y, align = 'center') => {
      ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,245,215,0.55)'; ctx.fillText(text, x + 1, y + 1.5);   // 彫りのハイライト
      ctx.fillStyle = '#3a250c'; ctx.fillText(text, x, y);
    };
    const fit = (text, style, size, family, maxW) => { do { ctx.font = `${style} ${size}px ${family}`; size -= 2; } while (ctx.measureText(text).width > maxW && size > 14); return ctx.font; };
    if (!name && !message) {
      engrave('Tokyo Christmas Market', 'italic 500 50px "Playfair Display", serif', w / 2, 70);
      engrave('—  MMXXVI  —', '500 22px "Playfair Display", serif', w / 2, 118);
    } else {
      engrave('TOKYO CHRISTMAS MARKET · MMXXVI', '500 20px "Playfair Display", serif', w / 2, 42);
      const main = name || message;
      engrave(main, fit(main, 'italic 600', 50, '"Playfair Display", "Noto Serif JP", serif', w - 170), w / 2, name && message ? 88 : 100);
      if (name && message) engrave(message, fit(message, '500', 24, '"Noto Serif JP", serif', w - 220), w / 2, 128);
    }
    if (edition) engrave(edition, 'italic 18px "Playfair Display", serif', w - 40, 42, 'right');
  });
}

// 飾る場所（ガラスの外に見える景色）
function outsideTexture(kind) {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const base = { studio: ['#4a4038', '#221d19', '#0b0908'], navy: ['#22346a', '#0f1a3d', '#060c22'], bokeh: ['#3a2a3a', '#1a1428', '#07060f'], window: ['#c8d8ee', '#7f97bf', '#2c3e66'] }[kind] || ['#22346a', '#0f1a3d', '#060c22'];
    const g = ctx.createRadialGradient(w / 2, h * 0.38, 0, w / 2, h / 2, w * 0.75);
    g.addColorStop(0, base[0]); g.addColorStop(0.55, base[1]); g.addColorStop(1, base[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (kind === 'bokeh' || kind === 'window') {
      const cols = kind === 'bokeh' ? ['255,196,110', '255,170,80', '255,225,160', '220,80,70', '255,240,200'] : ['255,255,255', '220,235,255', '255,240,210'];
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * w, y = Math.random() * h * (kind === 'bokeh' ? 0.85 : 1), r = 14 + Math.random() * 60;
        const c = cols[(Math.random() * cols.length) | 0];
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        const a = (kind === 'bokeh' ? 0.18 : 0.22) + Math.random() * 0.25;
        rg.addColorStop(0, `rgba(${c},${a})`); rg.addColorStop(0.7, `rgba(${c},${a * 0.8})`); rg.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      if (kind === 'window') { // 窓枠のシルエット
        ctx.fillStyle = 'rgba(30,22,16,0.55)';
        ctx.fillRect(w * 0.48, 0, w * 0.04, h * 0.78); ctx.fillRect(0, h * 0.36, w, h * 0.035);
        ctx.fillStyle = 'rgba(40,28,20,0.85)'; ctx.fillRect(0, h * 0.78, w, h * 0.22);
      }
    }
  });
}

export const WATER_TINTS = {
  clear: { name: '透明', color: null },
  blue:  { name: 'アイスブルー', color: 0x9fd3ff, op: 0.12 },
  gold:  { name: 'ゴールド', color: 0xffcf73, op: 0.14 },
  rose:  { name: 'ローズ', color: 0xffadc6, op: 0.12 },
  mint:  { name: 'ミント', color: 0xb6f2dc, op: 0.12 },
  night: { name: 'ミッドナイト', color: 0x3a4a9f, op: 0.18 },
};

export const GROUND_TYPES = {
  snow:   { name: '雪', color: 0xffffff, metalness: 0, roughness: 0.85 },
  gold:   { name: '金の雪', color: 0xe9c47c, metalness: 0.65, roughness: 0.35 },
  silver: { name: '銀の雪', color: 0xd8dde4, metalness: 0.7, roughness: 0.3 },
  pink:   { name: 'さくら色', color: 0xffd9e6, metalness: 0, roughness: 0.8 },
  ice:    { name: '氷', color: 0xd8f0ff, metalness: 0.1, roughness: 0.15 },
};

export const OUTSIDES = {
  studio: { name: 'スタジオ' },
  navy:   { name: 'ネイビー' },
  bokeh:  { name: '灯りの夜' },
  window: { name: '雪の窓辺' },
};

const BASE_MATERIALS = {
  walnut: () => new THREE.MeshPhysicalMaterial({ map: walnutTexture(), roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.18, metalness: 0 }),
  wood_dark: () => new THREE.MeshStandardMaterial({ map: woodTexture('#4a2e1c', '#1a0c06'), roughness: 0.5, metalness: 0 }),
  wood_light: () => new THREE.MeshStandardMaterial({ map: woodTexture('#9a7048', '#4a2a14'), roughness: 0.55, metalness: 0 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd4b06a, roughness: 0.28, metalness: 1 }),
  silver: () => new THREE.MeshStandardMaterial({ color: 0xd2d6dc, roughness: 0.22, metalness: 1 }),
  marble: () => new THREE.MeshPhysicalMaterial({ map: marbleTexture(), roughness: 0.22, clearcoat: 0.6 }),
  black: () => new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }),
};

const RIM_COLORS = {
  gold: { color: 0xd4b06a, metalness: 1, roughness: 0.25 },
  silver: { color: 0xd2d6dc, metalness: 1, roughness: 0.2 },
  black: { color: 0x111111, metalness: 0.3, roughness: 0.3 },
  red: { color: 0x8b1821, metalness: 0.3, roughness: 0.35 },
  none: null,
};

// 粒子スプライト（白で描いて頂点色で着色）。プレビュー用にも書き出す
export function drawSprite(ctx, kind, w) {
  const c = w / 2, k = w / 64;
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  if (kind === 'circle') {
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.9);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  } else if (kind === 'flake') {
    // ぼたん雪：いくつかの丸が集まった柔らかい形
    [[0, 0, 15], [-9, -5, 10], [8, -7, 11], [9, 7, 10], [-7, 8, 11]].forEach(([x, y, r]) => {
      const g = ctx.createRadialGradient(c + x * k, c + y * k, 0, c + x * k, c + y * k, r * k);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c + x * k, c + y * k, r * k, 0, Math.PI * 2); ctx.fill();
    });
  } else if (kind === 'crystal') {
    // 六角の雪の結晶
    ctx.lineWidth = 2.6 * k;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const ex = c + Math.cos(a) * 27 * k, ey = c + Math.sin(a) * 27 * k;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(ex, ey); ctx.stroke();
      [0.45, 0.72].forEach((t, j) => {
        const bx = c + Math.cos(a) * 27 * k * t, by = c + Math.sin(a) * 27 * k * t, L = (j ? 6 : 8.5) * k;
        [-1, 1].forEach((sg) => { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + sg * 0.9) * L, by + Math.sin(a + sg * 0.9) * L); ctx.stroke(); });
      });
    }
    ctx.beginPath(); ctx.arc(c, c, 4 * k, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'glint') {
    // ラメ：平たい六角の小片（傾くと光る）
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3 + 0.3; ctx.lineTo(c + Math.cos(a) * 20 * k, c + Math.sin(a) * 20 * k); }
    ctx.closePath(); ctx.fill();
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  } else if (kind === 'sparkle') {
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.6);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(c, 2 * k); ctx.lineTo(c + 5 * k, c - 5 * k); ctx.lineTo(w - 2 * k, c); ctx.lineTo(c + 5 * k, c + 5 * k);
    ctx.lineTo(c, w - 2 * k); ctx.lineTo(c - 5 * k, c + 5 * k); ctx.lineTo(2 * k, c); ctx.lineTo(c - 5 * k, c - 5 * k); ctx.closePath(); ctx.fill();
  } else if (kind === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = (i % 2 ? 11 : 26) * k; const a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  } else if (kind === 'heart') {
    ctx.beginPath(); ctx.moveTo(c, 50 * k);
    ctx.bezierCurveTo(6 * k, 30 * k, 12 * k, 8 * k, c, 22 * k); ctx.bezierCurveTo(52 * k, 8 * k, 58 * k, 30 * k, c, 50 * k); ctx.fill();
  } else if (kind === 'petal') {
    ctx.beginPath(); ctx.ellipse(c, c, 12 * k, 24 * k, 0.5, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'rect') {
    ctx.fillRect(c - 17 * k, c - 10 * k, 34 * k, 20 * k);
  } else if (kind === 'bubble') {
    const g = ctx.createRadialGradient(c, c, 18 * k, c, c, 26 * k);
    g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(0.8, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, 26 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.ellipse(c - 9 * k, c - 10 * k, 6 * k, 3.5 * k, -0.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function spriteTexture(kind) {
  return canvasTex(64, 64, (ctx, w) => drawSprite(ctx, kind, w));
}

// SVG文字列 → Canvas（パーツ・背景プリセット用）
function svgToCanvas(svg, maxSize) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const vb = /viewBox="([\d.\s-]+)"/.exec(svg);
      let w = 600, h = 600;
      if (vb) { const p = vb[1].trim().split(/\s+/).map(Number); w = p[2]; h = p[3]; }
      const s = maxSize / Math.max(w, h);
      const c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function alphaMask(source) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.drawImage(source, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  return (u, v) => {
    const x = Math.min(63, Math.max(0, Math.floor(u * 64)));
    const y = Math.min(63, Math.max(0, Math.floor((1 - v) * 64)));
    return d[(y * 64 + x) * 4 + 3];
  };
}

// 絵の明暗＋輪郭から凹凸（法線マップ）を作る：光の当たり方で立体的に見せる
const _normalCache = new Map();
function normalMapFrom(source, key) {
  if (key && _normalCache.has(key)) return _normalCache.get(key);
  const W = 256, H = Math.max(16, Math.round(256 * (source.height || source.naturalHeight) / (source.width || source.naturalWidth)));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(source, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const h = new Float32Array(W * H);
  // 高さ = 明るさ × 不透明度（輪郭がふくらむようにアルファをぼかして足す）
  const a = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3] / 255;
  const blur = (src) => {
    const out = new Float32Array(W * H), r = 4;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let k = -r; k <= r; k += 2) { const xx = Math.min(W - 1, Math.max(0, x + k)); const yy = Math.min(H - 1, Math.max(0, y + k));
        sum += src[y * W + xx] + src[yy * W + x]; n += 2; }
      out[y * W + x] = sum / n;
    }
    return out;
  };
  const ab = blur(blur(a));
  for (let i = 0; i < W * H; i++) {
    const lum = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    h[i] = ab[i] * 0.75 + lum * 0.25 * a[i];
  }
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const l = h[y * W + Math.max(0, x - 1)], r = h[y * W + Math.min(W - 1, x + 1)];
    const u = h[Math.max(0, y - 1) * W + x], dn = h[Math.min(H - 1, y + 1) * W + x];
    let nx = (l - r) * 6, ny = (dn - u) * 6, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    img.data[i * 4] = (nx * 0.5 + 0.5) * 255; img.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; img.data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  if (key) _normalCache.set(key, t);
  return t;
}

// パーツのタッチ（絵本 / 木彫り / 金細工 / 銀細工 / 白磁 / 切り絵）
export const PART_STYLES = {
  painted:   { name: '手描き',  id: 6, roughness: 0.8,  metalness: 0,   normal: 0.6 },
  picture:   { name: '絵本',   id: 0, roughness: 0.7,  metalness: 0,   normal: 0.35 },
  wood:      { name: '木彫り', id: 1, roughness: 0.55, metalness: 0,   normal: 1.1 },
  gold:      { name: '金細工', id: 2, roughness: 0.28, metalness: 1,   normal: 1.4 },
  silver:    { name: '銀細工', id: 3, roughness: 0.22, metalness: 1,   normal: 1.4 },
  porcelain: { name: '白磁',   id: 4, roughness: 0.18, metalness: 0,   normal: 1.2 },
  papercut:  { name: '切り絵', id: 5, roughness: 0.9,  metalness: 0,   normal: 0.0 },
};
const styleUniform = { value: 6 };
function applyStyleShader(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uStyle = styleUniform;
    sh.fragmentShader = 'uniform int uStyle;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float lumS = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      if (uStyle == 1) diffuseColor.rgb = mix(vec3(0.10, 0.045, 0.02), vec3(0.72, 0.45, 0.22), smoothstep(0.0, 0.75, sqrt(lumS)));
      else if (uStyle == 2) diffuseColor.rgb = mix(vec3(0.30, 0.17, 0.04), vec3(1.0, 0.78, 0.38), smoothstep(0.0, 0.85, sqrt(lumS)));
      else if (uStyle == 3) diffuseColor.rgb = mix(vec3(0.30, 0.32, 0.36), vec3(0.95, 0.96, 0.98), smoothstep(0.0, 0.85, sqrt(lumS)));
      else if (uStyle == 4) diffuseColor.rgb = mix(vec3(0.42, 0.52, 0.75), vec3(0.97, 0.96, 0.92), smoothstep(0.02, 0.5, lumS));
      else if (uStyle == 5) diffuseColor.rgb = vec3(0.012, 0.02, 0.06);
      else if (uStyle == 6) {
        // 手描き磁器風：彩度を落とし、赤を深いボルドーへ、全体を少し温かく
        vec3 c = diffuseColor.rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 0.58);
        float redness = clamp((c.r - max(c.g, c.b)) * 3.0, 0.0, 1.0);
        c = mix(c, c * vec3(0.78, 0.55, 0.58), redness * 0.55);
        c = c * vec3(1.03, 0.99, 0.92) * 0.95 + vec3(0.012, 0.009, 0.006);
        diffuseColor.rgb = c;
      }
    `);
  };
  mat.customProgramCacheKey = () => 'partStyle';
}

// 映り込み用の撮影スタジオ（暗い部屋に縦長のソフトボックス2灯＋天井の細い光）
function studioEnvironment() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: 0x15110e, side: THREE.BackSide }));
  env.add(room);
  const light = (w, h, x, y, z, ry, intensity, color = 0xfff3e0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; env.add(m);
  };
  light(1.1, 7.5, -6.5, 1, 3.5, Math.PI / 2.6, 5.0);         // 左の縦長ソフトボックス（メイン）
  light(0.6, 6.5, 7.0, 0.5, 2.0, -Math.PI / 2.4, 2.4, 0xe6efff); // 右の細いリムライト（少し青）
  const top = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff6e8).multiplyScalar(2.2) }));
  top.position.set(0, 5.9, 0); top.rotation.x = Math.PI / 2; env.add(top);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0x2a221c }));
  floor.position.y = -5.9; floor.rotation.x = -Math.PI / 2; env.add(floor);
  return env;
}

// ───────── 本体 ─────────
export class Globe {
  constructor(canvas, { onSelect = () => {}, onFlip = () => {} } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onFlip = onFlip;
    this.parts = new Map();
    this.selectedId = null;
    this.clock = new THREE.Clock();
    this.shakeT = 99;
    this.upsideDown = false;
    this.flipAngle = 0; this.flipFrom = 0; this.flipTo = 0; this.flipT = 1;
    this._gLocal = new THREE.Vector3();
    this._qInv = new THREE.Quaternion();

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, stencil: false }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.localClippingEnabled = true;

    const scene = (this.scene = new THREE.Scene());
    this.outsideTex = {};
    this.setOutside('studio');
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(studioEnvironment(), 0.02).texture;

    this.camera = new THREE.PerspectiveCamera(27, 1, 0.1, 50);
    this.camera.position.set(0, 0.35, 6.1);

    // 光
    scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1b2a52, 0.55));
    const key = new THREE.DirectionalLight(0xffe2b8, 1.7);
    key.position.set(1.6, 3.2, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 0.5, far: 8 });
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb0ff, 0.6);
    rim.position.set(-2.5, 1.5, -2);
    scene.add(rim);
    const warm = new THREE.PointLight(0xffb060, 0.8, 4, 2);
    warm.position.set(0, -0.2, 0.6);
    scene.add(warm);

    // 揺れるルート
    this.root = new THREE.Group();
    scene.add(this.root);
    this.interior = new THREE.Group();
    this.root.add(this.interior);
    this.partGroup = new THREE.Group();
    this.interior.add(this.partGroup);

    // 選択リング
    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe8c789, transparent: true, opacity: 0.85, depthWrite: false })
    );
    this.selRing.visible = false;
    this.selRing.renderOrder = 1;
    this.partGroup.add(this.selRing);

    // 入力（OrbitControls より先に登録して、パーツを掴んだら回転を止める）
    this.raycaster = new THREE.Raycaster();
    this._bindPointer();
    const c = (this.controls = new OrbitControls(this.camera, canvas));
    c.target.set(0, -0.22, 0);
    c.enableDamping = true;
    c.enablePan = false;
    c.minDistance = 3.6; c.maxDistance = 7.5;
    c.minAzimuthAngle = -0.95; c.maxAzimuthAngle = 0.95;
    c.minPolarAngle = 1.0; c.maxPolarAngle = 1.72;
    c.rotateSpeed = 0.7;
    c.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: -1, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.update();

    this._initParticles();
    this.setShape('circle');
    this.setBaseTheme('walnut');
    this.setRimTheme('gold');

    this._resizeObs = new ResizeObserver(() => this.resize());
    this._resizeObs.observe(canvas.parentElement);
    this.resize();
    this._loop();
  }

  // ───── サイズ ─────
  resize() {
    const el = this.canvas.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ───── 形状 ─────
  setShape(key) {
    this.ensureUpright();
    this.shapeKey = key;
    const spec = (this.spec = buildShape(key));
    [this.glassFront, this.glassBack, this.snowVol, this.snowCap, this.snowLayer, this.backdrop].forEach((m) => {
      if (m) { this.root.remove(m); this.interior.remove(m); m.geometry.dispose(); }
    });

    // ガラス（表・裏）
    const makeGlass = (side, strength) => {
      const m = new THREE.MeshPhysicalMaterial({
        color: 0x000000, roughness: 0.12, metalness: 0, envMapIntensity: 1.5,
        clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, depthWrite: false, side,
      });
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `
          #include <dithering_fragment>
          float fres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 3.0);
          float lum = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
          gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(1.25));
          gl_FragColor.a = clamp((0.025 + fres * 0.42 + smoothstep(0.3, 1.1, lum) * 0.5) * ${strength.toFixed(2)}, 0.0, 0.8);
        `);
      };
      const mesh = new THREE.Mesh(spec.geo, m);
      mesh.renderOrder = side === THREE.BackSide ? 5 : 6;
      return mesh;
    };
    this.glassBack = makeGlass(THREE.BackSide, 0.35);
    this.glassFront = makeGlass(THREE.FrontSide, 1.0);
    this.root.add(this.glassBack, this.glassFront);

    // 床：形状の下部を台座と同じ素材で満たす（クリップ）＋上面のキャップ
    this.clipLocal = new THREE.Plane(new THREE.Vector3(0, -1, 0), spec.groundY);
    this.clipWorld = this.clipLocal.clone();
    const volGeo = spec.geo.clone();
    volGeo.scale(0.985, 1, 0.985);
    this.snowVol = new THREE.Mesh(volGeo, new THREE.MeshStandardMaterial());
    this.snowVol.receiveShadow = true;
    this.interior.add(this.snowVol);

    const cap = spec.capGeo();
    cap.translate(0, spec.groundY, 0);
    this.snowCap = new THREE.Mesh(cap, new THREE.MeshStandardMaterial());
    this.snowCap.receiveShadow = true;
    this.interior.add(this.snowCap);

    // 積雪：粒が落ちた場所が盛り上がる（高さマップ）
    this._initSnowField();
    this._applyFloor();

    // 背景スクリーン
    this.backdrop = new THREE.Mesh(backdropGeometry(spec), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false }));
    this.backdrop.renderOrder = -1;
    this.interior.add(this.backdrop);
    if (this.bgTexture) this._applyBackdrop();

    // 水の色（内側の前後に薄い色の膜）
    [this.waterBack, this.waterFront].forEach((m) => { if (m) { this.root.remove(m); m.geometry.dispose(); } });
    const wg = spec.geo.clone(); wg.scale(0.97, 0.97, 0.97);
    const wm = (side, order) => { const m = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side, toneMapped: false })); m.renderOrder = order; return m; };
    this.waterBack = wm(THREE.BackSide, 3.5); this.waterFront = wm(THREE.FrontSide, 4.5);
    this.root.add(this.waterBack, this.waterFront);
    this.setWater(this.waterKey || 'clear');
    this.setGround(this.groundKey || 'snow');
    if (this.bgNone) this.backdrop.visible = false;

    this._buildBase();
    this._resetParticles();
    this.parts.forEach((p) => this._placePart(p));
    this._updateSelRing();
  }

  _buildBase() {
    const spec = this.spec;
    if (this.baseGroup) { this.root.remove(this.baseGroup); this.baseGroup.traverse((o) => o.geometry && o.geometry.dispose()); }
    const g = (this.baseGroup = new THREE.Group());
    const mat = this.baseMat || BASE_MATERIALS.gold();
    let plaque;
    if (spec.base === 'round') {
      // 正規化プロファイル（上端半径 1・上端 y=0）
      const prof = [[0.001, -0.62], [1.32, -0.62], [1.36, -0.585], [1.33, -0.55], [1.22, -0.5], [1.19, -0.46], [1.19, -0.17], [1.23, -0.13], [1.18, -0.08], [1.05, -0.03], [1.0, 0]]
        .map(([x, y]) => new THREE.Vector2(x, y));
      const s = spec.seatR + 0.05;
      const lg = new THREE.LatheGeometry(prof, 96);
      lg.scale(s, s * 0.95, s);
      lg.translate(0, spec.seatY + 0.02, 0);
      this.baseBottom = spec.seatY + 0.02 - 0.62 * s * 0.95;
      const base = new THREE.Mesh(lg, mat);
      base.castShadow = base.receiveShadow = true;
      g.add(base);
      const inlayMat = new THREE.MeshStandardMaterial({ color: 0xd4b06a, metalness: 1, roughness: 0.25 });
      [-0.47, -0.16].forEach((yy) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.195 * s, 0.006, 8, 120).rotateX(Math.PI / 2), inlayMat);
        ring.position.y = spec.seatY + 0.02 + yy * s * 0.95;
        g.add(ring);
      });
      // 銘板（前面の曲面）
      const pr = 1.19 * s + 0.004;
      const ph = 0.24 * s;
      const pg = new THREE.CylinderGeometry(pr, pr, ph, 48, 1, true, -0.62, 1.24);
      plaque = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: plaqueTexture(this.engraving), roughness: 0.4, metalness: 0.2 }));
      plaque.position.y = spec.seatY + 0.02 - 0.315 * s * 0.95;
      // リム
      this.rimMesh = new THREE.Mesh(new THREE.TorusGeometry(spec.seatR + 0.015, 0.03, 16, 96).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial());
      this.rimMesh.position.y = spec.seatY + 0.02;
    } else {
      const h = Math.max(0.46, spec.baseH || 0);
      const bg = new RoundedBoxGeometry(spec.baseW, h, spec.baseD, 4, 0.06);
      bg.translate(0, spec.seatY + 0.02 - h / 2, 0);
      this.baseBottom = spec.seatY + 0.02 - h;
      const base = new THREE.Mesh(bg, mat);
      base.castShadow = base.receiveShadow = true;
      g.add(base);
      const pw = Math.min(spec.baseW * 0.8, 1.5), ph = pw * 0.156;
      plaque = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: plaqueTexture(this.engraving), roughness: 0.4, metalness: 0.2 }));
      plaque.position.set(0, spec.seatY + 0.02 - h * 0.5, spec.baseD / 2 + 0.003);
      // リム（四角い枠）
      const fw = spec.baseW - 0.12, fd = spec.baseD - 0.12;
      const frame = new THREE.Shape();
      frame.moveTo(-fw / 2, -fd / 2); frame.lineTo(fw / 2, -fd / 2); frame.lineTo(fw / 2, fd / 2); frame.lineTo(-fw / 2, fd / 2); frame.closePath();
      const hole = new THREE.Path();
      const iw = fw - 0.08, id = fd - 0.08;
      hole.moveTo(-iw / 2, -id / 2); hole.lineTo(-iw / 2, id / 2); hole.lineTo(iw / 2, id / 2); hole.lineTo(iw / 2, -id / 2); hole.closePath();
      frame.holes.push(hole);
      const fg = new THREE.ExtrudeGeometry(frame, { depth: 0.04, bevelEnabled: false }).rotateX(-Math.PI / 2);
      this.rimMesh = new THREE.Mesh(fg, new THREE.MeshStandardMaterial());
      this.rimMesh.position.y = spec.seatY + 0.02;
    }
    this.plaque = plaque;
    g.add(plaque, this.rimMesh);
    this.root.add(g);
    this._applyRim();
  }

  setBaseTheme(key) {
    this.ensureUpright();
    this.baseKey = key;
    const mk = BASE_MATERIALS[key] || BASE_MATERIALS.gold;
    if (this.baseMat) this.baseMat.dispose();
    this.baseMat = mk();
    this._buildBase();
    this._applyFloor();
  }

  // 床は台座と同じ素材（雪は粒と積雪レイヤーで表現）
  _applyFloor() {
    if (!this.snowCap || !this.baseMat) return;
    const capMat = this.baseMat.clone();
    const volMat = this.baseMat.clone();
    volMat.side = THREE.DoubleSide;
    volMat.clippingPlanes = [this.clipWorld];
    [[this.snowCap, capMat], [this.snowVol, volMat]].forEach(([m, mat]) => { m.material.dispose(); m.material = mat; });
  }

  setRimTheme(key) {
    this.rimKey = key;
    this._applyRim();
  }

  _applyRim() {
    if (!this.rimMesh) return;
    const def = RIM_COLORS[this.rimKey || 'gold'];
    this.rimMesh.visible = !!def;
    if (def) Object.assign(this.rimMesh.material, { color: new THREE.Color(def.color), metalness: def.metalness, roughness: def.roughness });
  }

  // ───── 仕上げ（オリジナル感） ─────
  setOutside(key) {
    this.outsideKey = key;
    if (!this.outsideTex[key]) this.outsideTex[key] = outsideTexture(key);
    this.scene.background = this.outsideTex[key];
  }

  setWater(key) {
    this.waterKey = key;
    const w = WATER_TINTS[key] || WATER_TINTS.clear;
    [this.waterBack, this.waterFront].forEach((m, i) => {
      if (!m) return;
      m.visible = !!w.color;
      if (w.color) { m.material.color.set(w.color); m.material.opacity = w.op * (i === 0 ? 1.4 : 0.8); }
    });
  }

  setGround(key) {
    this.groundKey = key;
    const gt = GROUND_TYPES[key] || GROUND_TYPES.snow;
    if (this.snowLayer) {
      const m = this.snowLayer.material;
      m.color.set(gt.color); m.metalness = gt.metalness; m.roughness = gt.roughness;
      m.emissiveIntensity = gt.metalness > 0.3 ? 0.04 : 0.12;
    }
    // 粒の色も雪面に合わせる（金の雪に白い粒が積もると浮くため）
    this._groundTint = new THREE.Color(gt.color);
  }

  // ───── 積雪（高さマップ） ─────
  _initSnowField() {
    const s = this.spec, G = SNOW_GRID;
    this.snowG = G;
    this.snowExt = s.halfW * 1.04;
    this.snowStep = (2 * this.snowExt) / G;
    this.snowH = new Float32Array(G * G);
    this.snowMask = new Uint8Array(G * G);   // 積もれる範囲（床の上）
    this.snowVert = new Uint8Array(G * G);   // メッシュを張る範囲（すそを含む）
    let n = 0;
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const x = this._snowPos(i), z = this._snowPos(j);
        // 床の上は全部積もれる（ガラスぎわまで）
        const ok = s.onFloor ? s.onFloor(x, z) : s.inside(x, s.groundY + 0.02, z);
        this.snowMask[j * G + i] = ok ? 1 : 0;
        if (ok) n++;
      }
    }
    // 積もれる範囲の外側2周まで、高さ0の「すそ」を張って床となだらかにつなぐ
    this.snowVert.set(this.snowMask);
    for (let pass = 0; pass < 2; pass++) {
      const prev = this.snowVert.slice();
      for (let j = 0; j < G; j++) {
        for (let i = 0; i < G; i++) {
          if (prev[j * G + i]) continue;
          let near = false;
          for (let d = 0; d < 4 && !near; d++) {
            const ni = i + (d === 0 ? 1 : d === 1 ? -1 : 0);
            const nj = j + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (ni >= 0 && nj >= 0 && ni < G && nj < G && prev[nj * G + ni]) near = true;
          }
          if (near) this.snowVert[j * G + i] = 1;
        }
      }
    }
    this.snowCells = Math.max(1, n);
    // 粒1つが積もらせる高さ（標準の量で平均が SNOW_TARGET_DEPTH になるように）
    this.snowUnit = (SNOW_TARGET_DEPTH * this.snowCells) / PARTICLE_DEFAULT;
    this.snowDirty = true;
    this._buildSnowSurface();
  }

  _snowPos(i) { return -this.snowExt + (i + 0.5) * this.snowStep; }

  // 置いたパーツの根元に雪が寄り集まる（実物のスノードームらしさ）
  _rebuildSnowBump() {
    if (!this.snowH) return;
    const G = this.snowG;
    if (!this.snowBump) this.snowBump = new Float32Array(G * G);
    this.snowBump.fill(0);
    this.parts.forEach((p) => {
      if (p.hang || p.lift > 0.02) return;          // 吊るす・浮かせるものは対象外
      const w = Math.max(0.12, p.w * p.scale);
      const r = Math.min(0.3, w * 0.5), peak = Math.min(0.05, w * 0.16);
      const i0 = Math.max(0, ((p.x - r + this.snowExt) / this.snowStep) | 0);
      const i1 = Math.min(G - 1, ((p.x + r + this.snowExt) / this.snowStep) | 0);
      const j0 = Math.max(0, ((p.z - r + this.snowExt) / this.snowStep) | 0);
      const j1 = Math.min(G - 1, ((p.z + r + this.snowExt) / this.snowStep) | 0);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * G + i;
          if (!this.snowMask[k]) continue;
          const d = Math.hypot(this._snowPos(i) - p.x, this._snowPos(j) - p.z) / r;
          if (d >= 1) continue;
          const h = peak * (1 - d) * (1 - d);       // 根元ほど高い
          if (h > this.snowBump[k]) this.snowBump[k] = h;
        }
      }
    });
    this.snowDirty = true;
  }

  _snowIndex(x, z) {
    if (!this.snowH) return -1;
    const G = this.snowG;
    const i = ((x + this.snowExt) / this.snowStep) | 0;
    const j = ((z + this.snowExt) / this.snowStep) | 0;
    if (i < 0 || j < 0 || i >= G || j >= G) return -1;
    const k = j * G + i;
    return this.snowMask[k] ? k : -1;
  }

  // 高さマップ＋寄せ雪（雪が積もっている所だけ盛り上がる）
  _snowAt(k) {
    const h = this.snowH[k];
    const b = this.snowBump ? this.snowBump[k] : 0;
    return h + (b > 0 ? b * Math.min(1, h / 0.025) : 0);
  }

  // その場所に積もっている雪の高さ
  _snowTopAt(x, z) {
    const k = this._snowIndex(x, z);
    return k < 0 ? 0 : this._snowAt(k);
  }

  // 粒を1つ積もらせ、その粒がのる高さを返す
  _depositSnow(x, z) {
    const k = this._snowIndex(x, z);
    if (k < 0) return 0;
    const h = this._snowAt(k);
    this.snowH[k] = Math.min(SNOW_MAX_DEPTH, this.snowH[k] + this.snowUnit);
    this.snowDirty = true;
    return h;
  }

  _clearSnowField() { if (this.snowH) { this.snowH.fill(0); this.snowDirty = true; } }

  // 急な斜面は崩れて隣へ流れる（とがった山にならず、自然な裾野ができる）
  _slumpSnow() {
    const G = this.snowG, H = this.snowH, M = this.snowMask;
    if (!H) return;
    const maxStep = this.snowStep * 0.8;
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const k = j * G + i;
        if (!M[k] || H[k] <= 1e-6) continue;
        for (let d = 0; d < 4; d++) {
          const ni = i + (d === 0 ? 1 : d === 1 ? -1 : 0);
          const nj = j + (d === 2 ? 1 : d === 3 ? -1 : 0);
          const out = ni < 0 || nj < 0 || ni >= G || nj >= G || !M[nj * G + ni];
          if (out) {
            // 床のふち：積もりすぎた分はガラスとの隙間にこぼれ、裾がなだらかになる
            const over = H[k] - maxStep * 0.3;
            if (over > 0) { H[k] -= over * 0.3; this.snowDirty = true; }
            continue;
          }
          const nk = nj * G + ni;
          const over = H[k] - H[nk] - maxStep;
          if (over > 0) { const m = over * 0.3; H[k] -= m; H[nk] += m; this.snowDirty = true; }
        }
      }
    }
  }

  // 高さマップから雪面のメッシュを作る
  _buildSnowSurface() {
    if (this.snowLayer) { this.interior.remove(this.snowLayer); this.snowLayer.geometry.dispose(); this.snowLayer.material.dispose(); }
    const G = this.snowG, M = this.snowVert, gy = this.spec.groundY;
    const pos = [], col = [], idx = [];
    const vid = new Int32Array(G * G).fill(-1);
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const k = j * G + i;
        if (!M[k]) continue;
        vid[k] = pos.length / 3;
        pos.push(this._snowPos(i), gy, this._snowPos(j));
        col.push(1, 1, 1, 0);
      }
    }
    for (let j = 0; j < G - 1; j++) {
      for (let i = 0; i < G - 1; i++) {
        const a = vid[j * G + i], b = vid[j * G + i + 1], c = vid[(j + 1) * G + i + 1], d = vid[(j + 1) * G + i];
        if (a < 0 || b < 0 || c < 0 || d < 0) continue;
        idx.push(a, d, c, a, c, b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.snowVid = vid;
    const gt = GROUND_TYPES[this.groundKey || 'snow'] || GROUND_TYPES.snow;
    this.snowLayer = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: gt.color, metalness: gt.metalness, roughness: gt.roughness,
      emissive: 0x1a2440, emissiveIntensity: gt.metalness > 0.3 ? 0.04 : 0.12,
      vertexColors: true, transparent: true, depthWrite: false,
    }));
    this.snowLayer.receiveShadow = true;
    this.snowLayer.renderOrder = 1;
    this.snowLayer.visible = false;
    this.interior.add(this.snowLayer);
  }

  // 高さマップを雪面の形に反映（隣とならして、なめらかな山にする）
  _updateSnowSurface() {
    if (!this.snowLayer || !this.snowDirty) return;
    this.snowDirty = false;
    const G = this.snowG, M = this.snowVert, vid = this.snowVid;
    const geo = this.snowLayer.geometry;
    const p = geo.attributes.position.array, c = geo.attributes.color.array, nr = geo.attributes.normal.array;
    const gy = this.spec.groundY;
    const S = this.snowSmooth || (this.snowSmooth = new Float32Array(G * G));
    // 1) 隣とならした高さ
    let any = false;
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const k = j * G + i;
        if (!M[k]) { S[k] = 0; continue; }
        let h = this._snowAt(k) * 0.44, w = 0.44;
        for (let d = 0; d < 4; d++) {
          const ni = i + (d === 0 ? 1 : d === 1 ? -1 : 0);
          const nj = j + (d === 2 ? 1 : d === 3 ? -1 : 0);
          if (ni < 0 || nj < 0 || ni >= G || nj >= G) continue;
          const nk = nj * G + ni;
          if (!M[nk]) continue;
          h += this._snowAt(nk) * 0.14; w += 0.14;
        }
        S[k] = h / w;
        if (S[k] > 0.0008) any = true;
      }
    }
    // 2) 高さ・傾き（法線）・透明度
    const dy = 2 * this.snowStep;
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const k = j * G + i, v = vid[k];
        if (v < 0) continue;
        const h = S[k];
        p[v * 3 + 1] = gy + h;
        const hl = i > 0 && M[k - 1] ? S[k - 1] : h;
        const hr = i < G - 1 && M[k + 1] ? S[k + 1] : h;
        const hd = j > 0 && M[k - G] ? S[k - G] : h;
        const hu = j < G - 1 && M[k + G] ? S[k + G] : h;
        let nx = hl - hr, ny = dy, nz = hd - hu;
        const len = Math.hypot(nx, ny, nz) || 1;
        nr[v * 3] = nx / len; nr[v * 3 + 1] = ny / len; nr[v * 3 + 2] = nz / len;
        c[v * 4 + 3] = Math.min(1, Math.sqrt(h / 0.04));   // 薄いところは床が透けて、ふちがなだらかに消える
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    this.snowLayer.visible = any;
  }

  setEngraving({ name = '', message = '' } = {}) {
    if (!this.edition) this.edition = 'No.' + String(Math.floor(Math.random() * 9000) + 1000);
    this.engraving = { name: name.trim(), message: message.trim(), edition: (name.trim() || message.trim()) ? this.edition : '' };
    if (this.plaque) {
      const old = this.plaque.material.map;
      this.plaque.material.map = plaqueTexture(this.engraving);
      this.plaque.material.needsUpdate = true;
      if (old) old.dispose();
    }
  }

  setMusicBox(on) { this.musicBox = !!on; }

  // ───── 背景 ─────
  async setBackground({ svg, src, none }) {
    this.ensureUpright();
    this.bgNone = !!none;
    if (this.backdrop) this.backdrop.visible = !none;
    if (none) return;
    let tex;
    if (svg) tex = new THREE.CanvasTexture(await svgToCanvas(svg, 1024));
    else tex = new THREE.Texture(await loadImage(src));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    if (this.bgTexture) this.bgTexture.dispose();
    this.bgTexture = tex;
    this._applyBackdrop();
  }

  _applyBackdrop() {
    this.backdrop.material.map = this.bgTexture;
    this.backdrop.material.color.set(0xc8c8c8);
    this.backdrop.material.needsUpdate = true;
  }

  // ───── パーツ ─────
  async addPart(cat, { color } = {}) {
    this.ensureUpright();
    const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
    const source = cat.img ? await loadImage(cat.img) : await svgToCanvas(cat.svg.replace(/\{\{PRIMARY\}\}/g, color || cat.defaultColor || '#8b1821'), 512);
    const tex = cat.img ? new THREE.Texture(source) : new THREE.CanvasTexture(source);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const st = PART_STYLES[this.styleKey || 'painted'];
    // 公式キャラ・会場写真は色を変えない（磁器風の色調補正をかけず、トーンマップも外して本来の色で）
    const trueColor = !!cat.trueColor;
    const mat = new THREE.MeshStandardMaterial({
      map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: trueColor ? 0.75 : st.roughness, metalness: trueColor ? 0 : st.metalness,
      normalMap: normalMapFrom(source, cat.img || null), normalScale: new THREE.Vector2(trueColor ? 0.25 : st.normal, trueColor ? 0.25 : st.normal),
    });
    if (trueColor) {
      // 照明の当たり方は残しつつ、白飛び・色あせしないように
      mat.toneMapped = false;
      mat.color.setScalar(0.78);
      mat.emissiveMap = tex; mat.emissive.setScalar(0.22);
    } else applyStyleShader(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 });
    const n = this.parts.size;
    const part = {
      id, cat, mesh, color: color || cat.defaultColor, alpha: alphaMask(source),
      w: (cat.w || 120) * UNIT, h: (cat.h || 120) * UNIT,
      x: ((n % 5) - 2) * 0.22, z: 0.05 + ((n / 5) | 0) * 0.08 - 0.1, scale: 1, rotY: 0, lift: cat.lift || 0,
      hang: !!cat.hang,
    };
    if (part.hang) {
      // 吊るすもの：lift は「天井からのひもの長さ」として使う
      part.lift = cat.drop ?? 0.25;
      part.string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6), new THREE.MeshStandardMaterial({ color: 0xc9a66b, metalness: 0.8, roughness: 0.35 }));
      this.partGroup.add(part.string);
    }
    mesh.userData.partId = id;
    this.parts.set(id, part);
    this.partGroup.add(mesh);
    this._placePart(part);
    this.select(id);
    return id;
  }

  setPartStyle(key) {
    const st = PART_STYLES[key] || PART_STYLES.picture;
    this.styleKey = key;
    styleUniform.value = st.id;
    this.parts.forEach((p) => {
      if (p.cat.trueColor) return;
      Object.assign(p.mesh.material, { roughness: st.roughness, metalness: st.metalness });
      p.mesh.material.normalScale.set(st.normal, st.normal);
    });
  }

  async recolorPart(id, color) {
    const p = this.parts.get(id);
    if (!p || p.cat.img || !p.cat.svg) return;
    const c = await svgToCanvas(p.cat.svg.replace(/\{\{PRIMARY\}\}/g, color), 512);
    p.mesh.material.map.image = c;
    p.mesh.material.map.needsUpdate = true;
    p.alpha = alphaMask(c);
    p.color = color;
  }

  updatePart(id, delta) {
    const p = this.parts.get(id);
    if (!p) return;
    if (delta.scale) p.scale = Math.min(2.6, Math.max(0.35, p.scale * delta.scale));
    if (delta.rotY) p.rotY += delta.rotY;
    if (delta.lift) p.lift = p.hang ? Math.min(1.1, Math.max(0.04, p.lift - delta.lift)) : Math.min(1.2, Math.max(0, p.lift + delta.lift));
    if (delta.flip) p.flip = !p.flip;
    this._placePart(p);
    this._updateSelRing();
  }

  removePart(id) {
    const p = this.parts.get(id);
    if (!p) return;
    this.partGroup.remove(p.mesh);
    if (p.string) { this.partGroup.remove(p.string); p.string.geometry.dispose(); p.string.material.dispose(); }
    p.mesh.geometry.dispose(); p.mesh.material.map.dispose(); p.mesh.material.dispose();
    this.parts.delete(id);
    this.bumpDirty = true;
    if (this.selectedId === id) this.select(null);
  }

  clearParts() { this.ensureUpright(); [...this.parts.keys()].forEach((id) => this.removePart(id)); }

  select(id) {
    this.selectedId = id;
    this._updateSelRing();
    this.onSelect(id ? this.parts.get(id) : null);
  }

  // その位置の天井（ドーム内側の一番高いところ）
  _ceilingAt(x, z) {
    const s = this.spec;
    let lo = s.groundY + 0.05, hi = s.topY + 0.2;
    if (!s.inside(x, lo, z)) return lo;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (s.inside(x, m, z)) lo = m; else hi = m; }
    return lo;
  }

  _placeHanging(p) {
    const spec = this.spec;
    // 中心寄りに収める（天井の低い端では吊るせないため）
    let k = 1;
    const fits = (x, z) => {
      const W = p.w * p.scale, H = p.h * p.scale;
      const top = this._ceilingAt(x, z) - p.lift;
      return spec.inside(x, top - H, z) && spec.inside(x - W * 0.3, top - H * 0.5, z) && spec.inside(x + W * 0.3, top - H * 0.5, z) && top - H > spec.groundY + 0.12;
    };
    while (!fits(p.x * k, p.z * k) && k > 0) k -= 0.05;
    p.x *= Math.max(k, 0); p.z *= Math.max(k, 0);
    let guard = 0;
    while (!fits(p.x, p.z) && guard++ < 30) { if (p.lift > 0.06) p.lift *= 0.9; else if (p.scale > 0.35) p.scale *= 0.95; else break; }
    const W = p.w * p.scale, H = p.h * p.scale;
    const ceil = this._ceilingAt(p.x, p.z);
    const top = ceil - p.lift;
    p.mesh.scale.set(p.flip ? -W : W, H, 1);
    p.mesh.position.set(p.x, top - H, p.z);
    const len = Math.max(0.01, ceil - top + H * 0.08);
    p.string.scale.set(1, len, 1);
    p.string.position.set(p.x, ceil - len / 2, p.z);
  }

  _placePart(p) {
    if (p.hang) return this._placeHanging(p);
    const spec = this.spec;
    const w = p.w * p.scale, h = p.h * p.scale;
    // 地面の内側に収める（中心と左右端を判定し、だめなら中心へ寄せる）
    const ok = (x, z) => {
      const y = spec.groundY + 0.06 + p.lift;
      const hw = (w / 2) * 0.55;
      const c = Math.cos(p.rotY), s = Math.sin(p.rotY);
      return spec.inside(x, y, z) && spec.inside(x - hw * c, y, z + hw * s) && spec.inside(x + hw * c, y, z - hw * s)
        && spec.inside(x, Math.min(y + h * 0.9, spec.topY - 0.1), z);
    };
    let k = 1;
    while (!ok(p.x * k, p.z * k) && k > 0) k -= 0.05;
    p.x *= Math.max(k, 0); p.z *= Math.max(k, 0);
    // 高さがはみ出す場合は少し縮める
    let guard = 0;
    while (!ok(p.x, p.z) && p.scale > 0.35 && guard++ < 30) { p.scale *= 0.96; }
    const W = p.w * p.scale, H = p.h * p.scale;
    p.mesh.scale.set(p.flip ? -W : W, H, 1);
    p.mesh.position.set(p.x, spec.groundY + 0.02 + p.lift, p.z);
    this.bumpDirty = true;
  }

  _updateSelRing() {
    const p = this.parts.get(this.selectedId);
    this.selRing.visible = !!p;
    if (!p) return;
    const r = Math.max(p.w * p.scale * 0.55, 0.08);
    this.selRing.scale.set(r, 1, r * 0.55);
    this.selRing.position.set(p.x, this.spec.groundY + 0.035 + (p.lift > 0 ? 0 : 0.0), p.z);
  }

  _bindPointer() {
    const el = this.canvas;
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPt = new THREE.Vector3();
    let drag = null;
    let tilt = null;
    let downAt = null;

    const toNdc = (e) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const pickPart = () => {
      this.raycaster.setFromCamera(ndc, this.camera);
      const hits = this.raycaster.intersectObjects([...this.parts.values()].map((p) => p.mesh), false);
      for (const h of hits) {
        const p = this.parts.get(h.object.userData.partId);
        let u = h.uv.x; if (p.flip) u = 1 - u;
        if (p.alpha(u, h.uv.y) > 40) return p;
      }
      return null;
    };
    const groundPoint = (y) => {
      plane.constant = -y;
      this.raycaster.setFromCamera(ndc, this.camera);
      // ルートの揺れは無視できる程度なのでワールド平面で計算
      if (!this.raycaster.ray.intersectPlane(plane, hitPt)) return null;
      this.partGroup.updateMatrixWorld();
      return this.partGroup.worldToLocal(hitPt.clone());
    };

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      toNdc(e);
      downAt = { x: e.clientX, y: e.clientY };
      const p = (Math.cos(this.flipAngle) < 0.97 || this.flipT < 1) ? null : pickPart();
      if (p) {
        this.controls.enabled = false;
        this.dragging = true;
        this.select(p.id);
        const y = this.spec.groundY + 0.02 + p.lift;
        const g = groundPoint(y);
        drag = { p, y, off: g ? new THREE.Vector3(p.x - g.x, 0, p.z - g.z) : new THREE.Vector3() };
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      } else if ((e.pointerType !== 'mouse' || e.button === 0) && !this._twoFinger) {
        // ドームを掴んで傾ける（横ドラッグ。スマホは短い距離で半回転）
        tilt = { x0: e.clientX, y0: e.clientY, a0: this.flipAngle, id: e.pointerId, lastA: this.flipAngle, lastT: performance.now(), vel: 0,
          half: el.getBoundingClientRect().width * (e.pointerType === 'mouse' ? 0.55 : 0.38), started: false };
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });
    el.addEventListener('touchstart', (e) => { this._twoFinger = e.touches.length > 1; if (this._twoFinger && tilt) { tilt = null; this.tilting = false; this._settleTilt(0); } }, { passive: true });
    el.addEventListener('touchend', (e) => { if (e.touches.length < 2) this._twoFinger = false; }, { passive: true });
    el.addEventListener('pointermove', (e) => {
      if (tilt && e.pointerId === tilt.id) {
        const dx = e.clientX - tilt.x0;
        if (!tilt.started) {
          if (Math.abs(dx) < 6) return;
          tilt.started = true; this.tilting = true; this.flipT = 1;
          tilt.a0 = this.flipAngle; tilt.x0 = e.clientX; tilt.lastA = this.flipAngle;
          return;
        }
        // 右へドラッグ＝時計回りに傾く
        this.flipAngle = tilt.a0 - (dx / tilt.half) * Math.PI;
        const now = performance.now();
        const v = (this.flipAngle - tilt.lastA) / Math.max(1, now - tilt.lastT);
        tilt.vel = tilt.vel * 0.4 + v * 0.6;
        tilt.lastA = this.flipAngle; tilt.lastT = now;
        return;
      }
      if (!drag) return;
      toNdc(e);
      const g = groundPoint(drag.y);
      if (!g) return;
      drag.p.x = g.x + drag.off.x;
      drag.p.z = g.z + drag.off.z;
      this._placePart(drag.p);
      this._updateSelRing();
    });
    let lastTap = 0;
    this._cancelTilt = () => { tilt = null; this.tilting = false; };
    const up = (e) => {
      if (tilt) {
        const t0 = tilt; tilt = null; this.tilting = false;
        if (t0.started) {
          // 指を止めてから離した場合は勢いなし
          const vel = performance.now() - t0.lastT > 120 ? 0 : t0.vel;
          this._settleTilt(vel); downAt = null; return;
        }
      }
      if (drag) { drag = null; this.dragging = false; this.controls.enabled = true; }
      else if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 10) {
        const now = performance.now();
        if (now - lastTap < 400) { lastTap = 0; this.flip(!this.upsideDown); this.select(null); }
        else { lastTap = now; this.select(null); }
      }
      downAt = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      if (!this.selectedId) return;
      toNdc(e);
      const p = pickPart();
      if (p && p.id === this.selectedId) {
        e.preventDefault(); e.stopImmediatePropagation();
        this.updatePart(p.id, { scale: e.deltaY < 0 ? 1.06 : 0.94 });
      }
    }, { capture: true, passive: false });
  }

  // パーツを常にカメラ側へ向ける（横から見ても板に見えない）
  _faceCamera() {
    if (!this._camLocal) this._camLocal = new THREE.Vector3();
    this.partGroup.updateMatrixWorld();
    const cam = this.partGroup.worldToLocal(this._camLocal.copy(this.camera.position));
    this.parts.forEach((p) => {
      p.mesh.rotation.y = Math.atan2(cam.x - p.mesh.position.x, cam.z - p.mesh.position.z);
    });
  }

  // ───── 粒子 ─────
  _initParticles() {
    const N = PARTICLE_MAX;
    this.pCount = PARTICLE_DEFAULT;
    const g = new THREE.BufferGeometry();
    const attr = (name, n) => g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(N * n), n));
    attr('position', 3); attr('color', 3); attr('size', 1); attr('alpha', 1);
    attr('spin', 1); attr('phase', 1); attr('tumble', 1); attr('flash', 1);
    this.pv = new Float32Array(N * 3);
    this.pSettled = new Uint8Array(N);
    this.pRest = new Float32Array(N);
    this.pBase = new Float32Array(N);
    this.pSpeed = new Float32Array(N);
    this.pFreq = new Float32Array(N);
    this.pAmp = new Float32Array(N);
    this.pPh = new Float32Array(N).map(() => Math.random() * Math.PI * 2);
    // 振った直後の舞い上がり（粒ごとに遅れ・時間・渦の向きを変える）
    this.pTarget = new Float32Array(N * 3);
    this.pStart = new Float32Array(N * 3);
    this.pDelay = new Float32Array(N);
    this.pDur = new Float32Array(N);
    this.pSwirl = new Float32Array(N);
    this.pLift = new Float32Array(N);
    this.pSpread = new Uint8Array(N);
    this.spreadT = 99;
    this.spriteCache = {};
    this.pMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, scale: { value: 1 }, uTime: { value: 0 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        attribute float spin; attribute float phase; attribute float tumble; attribute float flash;
        varying vec3 vColor; varying float vAlpha; varying float vAng; varying float vSquash; varying float vFlash;
        uniform float scale; uniform float uTime;
        void main() {
          vColor = color; vAlpha = alpha;
          float ang = phase + spin * uTime;
          vAng = ang;
          // 裏返るように薄くなる（紙吹雪・花びら・ラメ）
          vSquash = mix(1.0, max(0.16, abs(cos(ang * 0.83 + phase * 1.7))), tumble);
          // 面が光の方を向いた一瞬だけキラッと光る
          float f = pow(abs(cos(ang * 1.27 + phase)), 18.0);
          vFlash = flash * f;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z * (1.0 + vFlash * 0.7);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec3 vColor; varying float vAlpha; varying float vAng; varying float vSquash; varying float vFlash;
        void main() {
          vec2 pc = gl_PointCoord - 0.5;
          float c = cos(vAng), s = sin(vAng);
          pc = vec2(c * pc.x - s * pc.y, s * pc.x + c * pc.y);
          pc.y /= vSquash;
          if (abs(pc.x) > 0.5 || abs(pc.y) > 0.5) discard;
          vec4 t = texture2D(map, pc + 0.5);
          float bright = 1.0 - vFlash * 0.0 + vFlash * 2.6;
          float a = t.a * vAlpha * (0.55 + 0.45 * vSquash) + t.a * vFlash * 0.6;
          if (a < 0.02) discard;
          gl_FragColor = vec4(vColor * t.rgb * bright, min(a, 1.0));
        }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.pMat);
    g.setDrawRange(0, this.pCount);
    this.points.renderOrder = 2;
    this.points.frustumCulled = false;
    this.interior.add(this.points);
    this.setParticle('snow', { stir: false });
  }

  setParticle(key, { stir = true } = {}) {
    if (stir) this.ensureUpright();
    const PRESETS = typeof PARTICLE_PRESETS !== 'undefined' ? PARTICLE_PRESETS : {};
    const P = PRESETS[key] || PRESETS.snow || { colors: ['#ffffff'], shape: 'circle', size: [1.2, 4.6], fall: 0.11, flutter: 0.7, spin: 0, tumble: 0, flash: 0 };
    this.preset = P;
    this.presetKey = key;
    const kind = P.shape;
    if (!this.spriteCache[kind]) this.spriteCache[kind] = spriteTexture(kind);
    this.pMat.uniforms.map.value = this.spriteCache[kind];
    this.pMat.blending = P.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.pMat.needsUpdate = true;
    const cols = P.colors.map((c) => new THREE.Color(c));
    const A = this.points.geometry.attributes;
    const mult = kind === 'circle' || kind === 'flake' ? 1.0 : 1.5;
    for (let i = 0; i < PARTICLE_MAX; i++) {
      const c = cols[(Math.random() * cols.length) | 0];
      A.color.setXYZ(i, c.r, c.g, c.b);
      const r = Math.pow(Math.random(), 1.8);              // 小さい粒が多く、大きい粒は少し
      A.size.setX(i, (P.size[0] + r * (P.size[1] - P.size[0])) * mult);
      this.pSpeed[i] = 0.55 + r * 0.7 + Math.random() * 0.35; // 大きい粒ほど少し速く沈む
      this.pFreq[i] = 0.6 + Math.random() * 1.5;
      this.pAmp[i] = 0.4 + Math.random() * 0.9;
      this.pBase[i] = 0.62 + Math.random() * 0.38;
      A.spin.setX(i, (P.spin || 0) * (0.5 + Math.random()) * (Math.random() < 0.5 ? -1 : 1));
      A.phase.setX(i, this.pPh[i]);
      A.tumble.setX(i, (P.tumble || 0) * (0.6 + Math.random() * 0.4));
      A.flash.setX(i, P.flash || 0);
    }
    ['color', 'size', 'spin', 'phase', 'tumble', 'flash'].forEach((n) => { A[n].needsUpdate = true; });
    if (this.amount) this.setParticleAmount(this.amount);
    if (stir) this.shake();
  }

  // 降らせるものの量（スライダーの値 × 種類ごとの密度 = 表示する粒子数）
  setParticleAmount(n) {
    this.amount = n;
    const prev = this.pCount;
    const dens = (this.preset && this.preset.density) || 1;
    this.pCount = Math.max(100, Math.min(PARTICLE_MAX, Math.round(n * dens)));
    this.points.geometry.setDrawRange(0, this.pCount);
    // 増えた分は宙に浮かせて自然に降らせる
    if (this.pCount > prev && this.spec) {
      const pos = this.points.geometry.attributes.position;
      for (let i = prev; i < this.pCount; i++) {
        const [x, y, z] = this._randomInSlice(this.spec.groundY + 0.05, this.spec.topY - 0.05);
        pos.setXYZ(i, x, y, z); this.pSettled[i] = 0; this.pSpread[i] = 0;
        this.pv[i * 3] = this.pv[i * 3 + 1] = this.pv[i * 3 + 2] = 0;
      }
      pos.needsUpdate = true;
    }
  }

  // 高さを均等に選んでから、その高さの断面の中で位置を選ぶ（見た目が上下まんべんなくなる）
  _randomInSlice(yMin, yMax) {
    const s = this.spec;
    for (let k = 0; k < 8; k++) {
      const y = yMin + Math.random() * (yMax - yMin);
      for (let j = 0; j < 30; j++) {
        const x = (Math.random() * 2 - 1) * s.halfW, z = (Math.random() * 2 - 1) * s.halfW;
        if (s.inside(x, y, z)) return [x, y, z];
      }
    }
    return this._randomInside(yMin);
  }

  _randomInside(yMin) {
    const s = this.spec;
    for (let k = 0; k < 60; k++) {
      const x = (Math.random() * 2 - 1) * s.halfW, y = yMin + Math.random() * (s.topY - yMin), z = (Math.random() * 2 - 1) * s.halfW;
      if (s.inside(x, y, z)) return [x, y, z];
    }
    return [0, s.groundY + 0.3, 0];
  }

  // 始まりの状態：大半は床に薄く積もった雪（積雪の層として見せる）、残りがふんわり舞っている
  _resetParticles(floating = 0.28) {
    if (!this.points || !this.spec) return;
    if (!this.snowH) this._initSnowField();
    this._clearSnowField();
    const pos = this.points.geometry.attributes.position;
    const s = this.spec, gy = s.groundY;
    let settled = 0;
    for (let i = 0; i < PARTICLE_MAX; i++) {
      this.pRest[i] = 0.004 + Math.random() * 0.011;   // 粒の厚み（雪面からの浮き）
      this.pSpread[i] = 0;
      this.pv[i * 3] = this.pv[i * 3 + 2] = 0; this.pv[i * 3 + 1] = -0.02;
      const [x, y, z] = this._randomInSlice(gy + 0.05, s.topY - 0.04);
      const rise = (this.preset || {}).fall < 0;
      if (!rise && i < this.pCount && Math.random() > floating && s.inside(x, gy + 0.06, z)) {
        pos.setXYZ(i, x, gy + this._depositSnow(x, z) + this.pRest[i], z);
        this.pSettled[i] = 1; settled++;
      } else { pos.setXYZ(i, x, y, z); this.pSettled[i] = 0; }
    }
    pos.needsUpdate = true;
    // 初期の山をならしておく
    for (let n = 0; n < 12; n++) this._slumpSnow();
    this._settleInitialFlakes();
  }

  // ならしたあとの雪面に、積もっている粒を座らせ直す
  _settleInitialFlakes() {
    const pos = this.points.geometry.attributes.position;
    const gy = this.spec.groundY;
    for (let i = 0; i < this.pCount; i++) {
      if (this.pSettled[i] !== 1) continue;
      const o = i * 3;
      pos.array[o + 1] = gy + this._snowTopAt(pos.array[o], pos.array[o + 2]) + this.pRest[i];
    }
    pos.needsUpdate = true;
  }

  _gravityLocal() {
    return this._gLocal.set(0, -1, 0).applyQuaternion(this._qInv.copy(this.root.quaternion).invert());
  }

  shake() {
    this.shakeT = 0;
    this.spreadT = 0;
    const s = this.spec;
    if (!s) return;
    this._clearSnowField();
    this.root.updateMatrixWorld();
    const upright = this._gravityLocal().y < -0.85;
    const pos = this.points.geometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_MAX; i++) {
      const o = i * 3;
      this.pSettled[i] = 0;
      const [x, y, z] = this._randomInSlice(s.groundY + 0.06, s.topY - 0.06);
      this.pTarget[o] = x; this.pTarget[o + 1] = y; this.pTarget[o + 2] = z;
      this.pStart[o] = pos[o]; this.pStart[o + 1] = pos[o + 1]; this.pStart[o + 2] = pos[o + 2];
      // 床の粒ほど少し遅れて巻き上がる → 一塊ではなく、渦を巻きながら次々と舞い上がる
      const low = pos[o + 1] < s.groundY + 0.08 ? 1 : 0;
      this.pDelay[i] = Math.random() * 0.25 + low * Math.random() * 0.45;
      this.pDur[i] = 0.75 + Math.random() * 0.75;
      this.pSwirl[i] = (Math.random() < 0.75 ? 1 : -1) * (0.9 + Math.random() * 1.8);
      this.pLift[i] = Math.random() * 0.35;
      this.pSpread[i] = upright ? 1 : 0;
      this.pv[o] = (Math.random() - 0.5) * 0.6;
      this.pv[o + 1] = Math.random() * 0.6;
      this.pv[o + 2] = (Math.random() - 0.5) * 0.6;
    }
  }

  _updateParticles(dt, t) {
    const P = this.preset, s = this.spec;
    const pos = this.points.geometry.attributes.position;
    const alpha = this.points.geometry.attributes.alpha;
    const rise = P.fall < 0;
    const fall = Math.abs(P.fall);
    // ドーム内（ローカル座標）での重力の向き。逆さまにすると天井側へ落ちる
    const g = this._gravityLocal();
    const dir = rise ? -1 : 1;
    const tx = g.x * fall * dir, ty = g.y * fall * dir, tz = g.z * fall * dir;
    // 重力に垂直な2方向（ひらひら揺れる向き）
    let e1x = g.y, e1y = -g.x, e1z = 0;
    let L = Math.hypot(e1x, e1y);
    if (L < 0.2) { e1x = 0; e1y = g.z; e1z = -g.y; L = Math.hypot(e1y, e1z); }
    e1x /= L; e1y /= L; e1z /= L;
    const e2x = g.y * e1z - g.z * e1y, e2y = g.z * e1x - g.x * e1z, e2z = g.x * e1y - g.y * e1x;
    const k = Math.min(1, dt * 1.8);
    this.spreadT += dt;
    const turb = 0.42 * Math.exp(-(this.shakeT || 0) * 0.42);  // 振った後の水の流れ（だんだん静まる）
    const upright = g.y < -0.85;
    const flut = (P.flutter || 0) * 0.07;
    const cy = (s.groundY + s.topY) / 2;
    let onGround = 0;
    for (let i = 0; i < this.pCount; i++) {
      const o = i * 3;
      let x = pos.array[o], y = pos.array[o + 1], z = pos.array[o + 2];
      let a = this.pBase[i];
      if (this.pSettled[i] === 1 && !upright) this.pSettled[i] = 0;
      else if (this.pSettled[i] === 2 && (upright || s.inside(x + g.x * 0.04, y + g.y * 0.04, z + g.z * 0.04))) { this.pSettled[i] = 0; this.pv[o] = g.x * 0.2; this.pv[o + 1] = g.y * 0.2; this.pv[o + 2] = g.z * 0.2; }

      if (this.pSpread[i]) {
        if (!upright) this.pSpread[i] = 0;
        const u = (this.spreadT - this.pDelay[i]) / this.pDur[i];
        if (u >= 1) {
          this.pSpread[i] = 0;
          x = this.pTarget[o]; y = this.pTarget[o + 1]; z = this.pTarget[o + 2];
          const sw = Math.sign(this.pSwirl[i]) * 0.3;
          this.pv[o] = -z * sw; this.pv[o + 1] = 0.02; this.pv[o + 2] = x * sw;
        } else if (u > 0) {
          const e = 1 - (1 - u) ** 3, bump = 4 * e * (1 - e);
          let bx = this.pStart[o] + (this.pTarget[o] - this.pStart[o]) * e;
          const by = this.pStart[o + 1] + (this.pTarget[o + 1] - this.pStart[o + 1]) * e + this.pLift[i] * bump;
          let bz = this.pStart[o + 2] + (this.pTarget[o + 2] - this.pStart[o + 2]) * e;
          const an = this.pSwirl[i] * bump, ca = Math.cos(an), sa = Math.sin(an);
          let rx = bx * ca - bz * sa, rz = bx * sa + bz * ca;
          let ok = s.inside(rx, by, rz);
          for (let q = 0; !ok && q < 4; q++) { rx *= 0.88; rz *= 0.88; ok = s.inside(rx, by, rz); }
          if (ok) { x = rx; y = by; z = rz; }
          else if (s.inside(bx, by, bz)) { x = bx; y = by; z = bz; }
        }
      } else if (!this.pSettled[i]) {
        const ps = this.pSpeed[i];
        const w = this.pFreq[i], ph = this.pPh[i];
        const f1 = Math.sin(t * w + ph) * flut * this.pAmp[i];
        const f2 = Math.cos(t * w * 0.83 + ph * 1.3) * flut * this.pAmp[i];
        // 渦（ドームの軸まわり）＋ゆるい乱れ
        const nx = Math.sin(y * 3.1 + t * 0.9 + ph) * turb * 0.35;
        const nz = Math.cos(x * 2.7 - t * 0.8 + ph) * turb * 0.35;
        const vx = (this.pv[o] += (tx * ps + f1 * e1x + f2 * e2x - z * turb + nx - this.pv[o]) * k);
        const vy = (this.pv[o + 1] += (ty * ps + f1 * e1y + f2 * e2y + Math.sin(z * 2.3 + t + ph) * turb * 0.18 - this.pv[o + 1]) * k);
        const vz = (this.pv[o + 2] += (tz * ps + f1 * e1z + f2 * e2z + x * turb + nz - this.pv[o + 2]) * k);
        const nx2 = x + vx * dt, ny2 = y + vy * dt, nz2 = z + vz * dt;
        if (s.inside(nx2, ny2, nz2)) { x = nx2; y = ny2; z = nz2; }
        else if (!rise && (vx * g.x + vy * g.y + vz * g.z) > 0.02 && !upright) {
          // 重力の向きに進んで壁に当たった → 壁に沿って一番低いところまで滑り、そこで止まる
          const sx = x - x * 0.05 + g.x * 0.03, sy = y + (cy - y) * 0.05 + g.y * 0.03, sz = z - z * 0.05 + g.z * 0.03;
          if (s.inside(sx, sy, sz) && ((sx - x) * g.x + (sy - y) * g.y + (sz - z) * g.z) > 0.0008) { x = sx; y = sy; z = sz; }
          else this.pSettled[i] = 2;
        } else {
          this.pv[o] *= -0.3; this.pv[o + 1] *= -0.3; this.pv[o + 2] *= -0.3;
          x *= 0.985; z *= 0.985; y = (y - cy) * 0.985 + cy;
        }
        if (!rise && g.y < 0) {
          // 雪面（すでに積もった高さ）の上に着地する
          const top = s.groundY + this._snowTopAt(x, z) + this.pRest[i];
          if (y <= top) {
            y = top;
            if (upright && s.inside(x, s.groundY + 0.06, z)) {
              y = s.groundY + this._depositSnow(x, z) + this.pRest[i];
              this.pSettled[i] = 1;
            }
          }
        }
        if (rise && y > s.topY - 0.15) {
          const [rx, , rz] = this._randomInside(s.groundY);
          x = rx; z = rz; y = s.groundY + 0.05;
        }
      }
      if (this.pSettled[i]) { a *= this.pSettled[i] === 1 ? 0.45 : 0.85; if (this.pSettled[i] === 1) onGround++; }
      pos.array[o] = x; pos.array[o + 1] = y; pos.array[o + 2] = z;
      alpha.array[i] = a;
    }
    pos.needsUpdate = true;
    alpha.needsUpdate = true;
    // 傾けている間は積もった雪が滑り落ちる
    if (!upright && this.snowH) {
      const k2 = Math.pow(0.9, dt * 60);
      for (let n = 0; n < this.snowH.length; n++) this.snowH[n] *= k2;
      this.snowDirty = true;
    }
    this.onGround = onGround;
  }

  // 指を離したとき：勢い（フリック）も加味して、近い方（正立／逆さ）へ落ち着かせる
  _settleTilt(vel = 0) {
    const a = this.flipAngle;
    const proj = a + Math.max(-1.8, Math.min(1.8, vel * 260));
    const n = Math.round(proj / Math.PI);
    const target = n * Math.PI;
    this.upsideDown = Math.abs(n % 2) === 1;
    this.flipFrom = a; this.flipTo = target; this.flipT = 0;
    this.flipDur = 0.45 + 0.5 * Math.min(1, Math.abs(target - a) / Math.PI);
    this.onFlip(this.upsideDown);
  }

  // 逆さまにする / 元に戻す
  flip(upsideDown = !this.upsideDown) {
    const turns = Math.round(this.flipAngle / (Math.PI * 2));
    const to = turns * Math.PI * 2 + (upsideDown ? Math.PI : 0);
    if (upsideDown === this.upsideDown && Math.abs(this.flipAngle - to) < 1e-3 && Math.abs(this.flipTo - to) < 1e-3) return this.upsideDown;
    if (this._cancelTilt) this._cancelTilt();
    this.upsideDown = upsideDown;
    this.flipFrom = this.flipAngle;
    this.flipTo = to;
    this.flipDur = 1.1;
    this.flipT = 0;
    this._clearSnowField();
    // 積もっていた雪をはがして、新しい重力で落ち直させる
    for (let i = 0; i < this.pCount; i++) {
      this.pSettled[i] = 0; this.pSpread[i] = 0;
      this.pv[i * 3] = (Math.random() - 0.5) * 0.3;
      this.pv[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      this.pv[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    this.onFlip(upsideDown);
    return upsideDown;
  }

  // 中身を変えるときは、まず正立に戻す（逆さのまま組み替えると表示がずれるため）
  ensureUpright() {
    const tilted = Math.abs(Math.cos(this.flipAngle) - 1) > 0.002 || Math.abs(Math.cos(this.flipTo) - 1) > 0.002;
    if (this.upsideDown || tilted || this.tilting) { this.flip(false); return true; }
    return false;
  }

  // ───── ループ ─────
  _loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this.shakeT += dt;
    const k = Math.exp(-this.shakeT * 3.2);
    if (this.flipT < 1) {
      this.flipT = Math.min(1, this.flipT + dt / (this.flipDur || 1.3));
      const e = this.flipT < 0.5 ? 4 * this.flipT ** 3 : 1 - (-2 * this.flipT + 2) ** 3 / 2;
      this.flipAngle = this.flipFrom + (this.flipTo - this.flipFrom) * e;
      if (this.flipT >= 1) { this.flipAngle = this.flipTo; this.flipDur = 1.3; }
    }
    this.root.rotation.z = this.flipAngle + Math.sin(this.shakeT * 22) * 0.06 * k;
    // ドーム＋台座の中心を軸に回す（逆さにしても画面からはみ出さない）
    const c = ((this.spec.topY + (this.baseBottom ?? -1.1)) / 2), th = this.root.rotation.z;
    this.root.position.set(c * Math.sin(th), c - c * Math.cos(th), 0);
    // 逆さの間は視点の中心も鏡写しの位置へ（カメラごと平行移動）
    const ty = -0.22 + (2 * c + 0.44) * (1 - Math.cos(this.flipAngle)) / 2;
    const dy = ty - this.controls.target.y;
    if (Math.abs(dy) > 1e-5) { this.controls.target.y += dy; this.camera.position.y += dy; }
    this.root.rotation.x = Math.sin(this.shakeT * 17 + 1) * 0.03 * k;
    this.root.updateMatrixWorld();
    this.clipWorld.copy(this.clipLocal).applyMatrix4(this.root.matrixWorld);
    this._updateParticles(dt, t);
    if (this.bumpDirty) { this.bumpDirty = false; this._rebuildSnowBump(); }
    this._slumpSnow();
    if ((this._snowTick = (this._snowTick || 0) + 1) % 3 === 0) this._updateSnowSurface();
    const round = this.spec.base === 'round';
    if (this.musicBox && !this.dragging) {
      this.mbT = (this.mbT || 0) + dt;
      if (round) this.partGroup.rotation.y += dt * 0.32;
      else this.partGroup.rotation.y = Math.sin(this.mbT * 0.5) * 0.22;
    } else if (!this.musicBox && Math.abs(this.partGroup.rotation.y) > 1e-4) {
      // 止めたら一番近い正面に戻す
      const r = this.partGroup.rotation.y, tgt = Math.round(r / (Math.PI * 2)) * Math.PI * 2;
      this.partGroup.rotation.y += (tgt - r) * Math.min(1, dt * 3);
      this.mbT = 0;
    }
    this._faceCamera();
    this.pMat.uniforms.scale.value = this.renderer.domElement.height * 0.015;
    this.pMat.uniforms.uTime.value = t;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this._loop());
  }

  // ───── 書き出し ─────
  exportPNG(size = 1200) {
    const r = this.renderer;
    const prevPR = r.getPixelRatio();
    const prev = r.getSize(new THREE.Vector2());
    const ring = this.selRing.visible;
    this.selRing.visible = false;
    r.setPixelRatio(1);
    r.setSize(size, size, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    this.pMat.uniforms.scale.value = size * 0.015;
    r.render(this.scene, this.camera);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.drawImage(r.domElement, 0, 0);
    r.setPixelRatio(prevPR);
    r.setSize(prev.x, prev.y, false);
    this.selRing.visible = ring;
    this.resize();
    return c.toDataURL('image/png');
  }
}
