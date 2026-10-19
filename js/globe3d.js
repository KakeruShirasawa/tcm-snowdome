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

// 粒子スプライト（白で描いて頂点色で着色）
function spriteTexture(kind) {
  return canvasTex(64, 64, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    if (kind === 'circle') {
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
    } else if (kind === 'sparkle') {
      const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.6);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(c, 2); ctx.lineTo(c + 5, c - 5); ctx.lineTo(w - 2, c); ctx.lineTo(c + 5, c + 5);
      ctx.lineTo(c, w - 2); ctx.lineTo(c - 5, c + 5); ctx.lineTo(2, c); ctx.lineTo(c - 5, c - 5); ctx.closePath(); ctx.fill();
    } else if (kind === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28; const a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    } else if (kind === 'heart') {
      ctx.beginPath(); ctx.moveTo(c, 52);
      ctx.bezierCurveTo(4, 30, 10, 6, c, 20); ctx.bezierCurveTo(54, 6, 60, 30, c, 52); ctx.fill();
    } else if (kind === 'petal') {
      ctx.beginPath(); ctx.ellipse(c, c, 14, 26, 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'rect') {
      ctx.fillRect(14, 22, 36, 20);
    } else if (kind === 'bubble') {
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c, c, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(c - 9, c - 9, 6, 0, Math.PI * 2); ctx.fill();
    }
  });
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
  constructor(canvas, { onSelect = () => {} } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect;
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

    // 積雪：床に積もった粒の量に応じて現れる白い層（逆さにすると消える）
    const layer = cap.clone();
    layer.translate(0, 0.006, 0);
    this.snowLayer = new THREE.Mesh(layer, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, emissive: 0x1a2440, emissiveIntensity: 0.12, transparent: true, opacity: 1 }));
    this.snowLayer.receiveShadow = true;
    this.snowLayer.renderOrder = 1;
    this.interior.add(this.snowLayer);
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
    this._resetParticles(true);
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
    const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
    const source = cat.img ? await loadImage(cat.img) : await svgToCanvas(cat.svg.replace(/\{\{PRIMARY\}\}/g, color || cat.defaultColor || '#8b1821'), 512);
    const tex = cat.img ? new THREE.Texture(source) : new THREE.CanvasTexture(source);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const st = PART_STYLES[this.styleKey || 'painted'];
    const mat = new THREE.MeshStandardMaterial({
      map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: st.roughness, metalness: st.metalness,
      normalMap: normalMapFrom(source, cat.img || null), normalScale: new THREE.Vector2(st.normal, st.normal),
    });
    applyStyleShader(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 });
    const n = this.parts.size;
    const part = {
      id, cat, mesh, color: color || cat.defaultColor, alpha: alphaMask(source),
      w: (cat.w || 120) * UNIT, h: (cat.h || 120) * UNIT,
      x: ((n % 5) - 2) * 0.22, z: 0.05 + ((n / 5) | 0) * 0.08 - 0.1, scale: 1, rotY: 0, lift: 0,
    };
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
    if (delta.lift) p.lift = Math.min(1.2, Math.max(0, p.lift + delta.lift));
    if (delta.flip) p.flip = !p.flip;
    this._placePart(p);
    this._updateSelRing();
  }

  removePart(id) {
    const p = this.parts.get(id);
    if (!p) return;
    this.partGroup.remove(p.mesh);
    p.mesh.geometry.dispose(); p.mesh.material.map.dispose(); p.mesh.material.dispose();
    this.parts.delete(id);
    if (this.selectedId === id) this.select(null);
  }

  clearParts() { [...this.parts.keys()].forEach((id) => this.removePart(id)); }

  select(id) {
    this.selectedId = id;
    this._updateSelRing();
    this.onSelect(id ? this.parts.get(id) : null);
  }

  _placePart(p) {
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
        el.setPointerCapture?.(e.pointerId);
      } else if ((e.pointerType !== 'mouse' || e.button === 0) && !this._twoFinger) {
        // ドームを掴んで傾ける（横ドラッグで最大360°）
        tilt = { x0: e.clientX, a0: this.flipAngle, id: e.pointerId, lastX: e.clientX, lastT: performance.now(), vel: 0 };
        this.flipT = 1;
        this.tilting = true;
        el.setPointerCapture?.(e.pointerId);
      }
    });
    el.addEventListener('touchstart', (e) => { this._twoFinger = e.touches.length > 1; if (this._twoFinger && tilt) { tilt = null; this.tilting = false; this._settleTilt(0); } }, { passive: true });
    el.addEventListener('touchend', (e) => { if (e.touches.length < 2) this._twoFinger = false; }, { passive: true });
    el.addEventListener('pointermove', (e) => {
      if (tilt && e.pointerId === tilt.id) {
        const w = el.getBoundingClientRect().width;
        // 右へドラッグ＝時計回りに傾く。画面幅の約 55% で半回転
        this.flipAngle = tilt.a0 - ((e.clientX - tilt.x0) / (w * 0.55)) * Math.PI;
        const now = performance.now();
        tilt.vel = (e.clientX - tilt.lastX) / Math.max(1, now - tilt.lastT);
        tilt.lastX = e.clientX; tilt.lastT = now;
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
    const up = (e) => {
      if (tilt) {
        const moved = Math.abs(e.clientX - tilt.x0) > 6;
        tilt = null; this.tilting = false;
        if (moved) { this._settleTilt(); downAt = null; return; }
      }
      if (drag) { drag = null; this.dragging = false; this.controls.enabled = true; }
      else if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6) this.select(null);
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
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N), 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(N), 1));
    this.pv = new Float32Array(N * 3);
    this.pPhase = new Float32Array(N);
    this.pSettled = new Uint8Array(N);
    this.pRest = new Float32Array(N);
    this.pBase = new Float32Array(N);
    this.pSpeed = new Float32Array(N).map(() => 0.35 + Math.random() * 0.95);   // 粒ごとに落ちる速さを変える
    this.pTarget = new Float32Array(N * 3);
    this.spreadT = 99;
    this.spriteCache = {};
    this.pMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, scale: { value: 1 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha;
        uniform float scale;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          float a = t.a * vAlpha;
          if (a < 0.02) discard;
          gl_FragColor = vec4(vColor * t.rgb, a);
        }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.pMat);
    g.setDrawRange(0, this.pCount);
    this.points.renderOrder = 2;
    this.points.frustumCulled = false;
    this.interior.add(this.points);
    this.setParticle('snow');
  }

  setParticle(key) {
    const PRESETS = typeof PARTICLE_PRESETS !== 'undefined' ? PARTICLE_PRESETS : {};
    const P = PRESETS[key] || { colors: ['#ffffff'], shape: 'circle', size: [1.5, 4], speed: [0.3, 1.3], sway: 0.7 };
    this.preset = P;
    this.presetKey = key;
    const kind = P.shape;
    if (!this.spriteCache[kind]) this.spriteCache[kind] = spriteTexture(kind);
    this.pMat.uniforms.map.value = this.spriteCache[kind];
    this.pMat.blending = P.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.pMat.needsUpdate = true;
    const cols = P.colors.map((c) => new THREE.Color(c.startsWith('rgba') ? c.replace(/rgba\((\d+),(\d+),(\d+),[^)]*\)/, 'rgb($1,$2,$3)') : c));
    const col = this.points.geometry.attributes.color;
    const size = this.points.geometry.attributes.size;
    for (let i = 0; i < PARTICLE_MAX; i++) {
      const c = cols[(Math.random() * cols.length) | 0];
      col.setXYZ(i, c.r, c.g, c.b);
      size.setX(i, (P.size[0] + Math.random() * (P.size[1] - P.size[0])) * (kind === 'circle' ? 1.0 : 1.6));
      this.pBase[i] = 0.75 + Math.random() * 0.25;
    }
    col.needsUpdate = true; size.needsUpdate = true;
    this._resetParticles(true);
    this.shake();
  }

  // 降らせるものの量（表示する粒子数）
  setParticleAmount(n) {
    const prev = this.pCount;
    this.pCount = Math.max(100, Math.min(PARTICLE_MAX, Math.round(n)));
    this.points.geometry.setDrawRange(0, this.pCount);
    // 増えた分は宙に浮かせて自然に降らせる
    if (this.pCount > prev) {
      const pos = this.points.geometry.attributes.position;
      for (let i = prev; i < this.pCount; i++) {
        const [x, y, z] = this._randomInside(this.spec.groundY + 0.05);
        pos.setXYZ(i, x, y, z); this.pSettled[i] = 0;
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

  _resetParticles(settle) {
    if (!this.points || !this.spec) return;
    const pos = this.points.geometry.attributes.position;
    const gy = this.spec.groundY;
    for (let i = 0; i < PARTICLE_MAX; i++) {
      const [x, y, z] = this._randomInside(gy + 0.02);
      this.pRest[i] = gy + 0.012 + Math.random() * 0.02;
      if (settle && Math.random() < 0.75) { pos.setXYZ(i, x, this.pRest[i], z); this.pSettled[i] = this.spec.inside(x, gy + 0.06, z) ? 1 : 0; if (!this.pSettled[i]) pos.setXYZ(i, x, y, z); }
      else { pos.setXYZ(i, x, y, z); this.pSettled[i] = 0; }
      this.pv[i * 3] = this.pv[i * 3 + 1] = this.pv[i * 3 + 2] = 0;
      this.pPhase[i] = Math.random() * Math.PI * 2;
    }
    pos.needsUpdate = true;
  }

  shake() {
    this.shakeT = 0;
    this.spreadT = 0;
    const s = this.spec;
    if (!s) return;
    for (let i = 0; i < PARTICLE_MAX; i++) {
      this.pSettled[i] = 0;
      // ドーム内のどこかへ均等に散らす（床から少し上〜天井まで）
      const [x, y, z] = this._randomInSlice(s.groundY + 0.06, s.topY - 0.06);
      this.pTarget[i * 3] = x; this.pTarget[i * 3 + 1] = y; this.pTarget[i * 3 + 2] = z;
      this.pv[i * 3] = (Math.random() - 0.5) * 0.6;
      this.pv[i * 3 + 1] = Math.random() * 0.6;
      this.pv[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
  }

  _updateParticles(dt, t) {
    const P = this.preset, s = this.spec;
    const pos = this.points.geometry.attributes.position;
    const alpha = this.points.geometry.attributes.alpha;
    const rise = P.speed[0] < 0;
    const fall = (Math.abs(P.speed[0]) + Math.abs(P.speed[1])) * 0.06;
    // ドーム内（ローカル座標）での重力の向き。逆さまにすると天井側へ落ちる
    const g = this._gLocal.set(0, -1, 0).applyQuaternion(this._qInv.copy(this.root.quaternion).invert());
    const dir = rise ? -1 : 1;
    const tx = g.x * fall * dir, ty = g.y * fall * dir, tz = g.z * fall * dir;
    const k = Math.min(1, dt * 1.6);
    this.spreadT += dt;
    const spreading = this.spreadT < 0.8 && g.y < -0.85;
    const swirl = 0.55 * Math.exp(-(this.shakeT || 0) * 0.45);   // 振った後のゆるい渦
    const upright = g.y < -0.85;
    const sway = (P.sway || 1);
    for (let i = 0; i < this.pCount; i++) {
      const o = i * 3;
      let x = pos.array[o], y = pos.array[o + 1], z = pos.array[o + 2];
      let a = this.pBase[i];
      if (P.twinkle) a *= 0.45 + 0.55 * Math.abs(Math.sin(t * 3 + this.pPhase[i]));
      if (this.pSettled[i] === 1 && !upright) this.pSettled[i] = 0;
      else if (this.pSettled[i] === 2 && (upright || s.inside(x + g.x * 0.04, y + g.y * 0.04, z + g.z * 0.04))) { this.pSettled[i] = 0; this.pv[i * 3] = g.x * 0.2; this.pv[i * 3 + 1] = g.y * 0.2; this.pv[i * 3 + 2] = g.z * 0.2; }
      if (!this.pSettled[i]) {
        let vx, vy, vz;
        if (spreading) {
          // 振った直後：割り当てた場所へ散っていく
          const sp = 7.0 * (1 - this.spreadT / 0.8) + 1.0;
          vx = this.pv[o] = (this.pTarget[o] - x) * sp;
          vy = this.pv[o + 1] = (this.pTarget[o + 1] - y) * sp;
          vz = this.pv[o + 2] = (this.pTarget[o + 2] - z) * sp;
        } else {
          const ps = this.pSpeed[i];
          vx = (this.pv[o] += (tx * ps + (-z) * swirl - this.pv[o]) * k);
          vy = (this.pv[o + 1] += (ty * ps - this.pv[o + 1]) * k);
          vz = (this.pv[o + 2] += (tz * ps + x * swirl - this.pv[o + 2]) * k);
        }
        const nx = x + (vx + Math.sin(t * 1.3 + this.pPhase[i]) * sway * 0.05) * dt;
        const ny = y + vy * dt;
        const nz = z + (vz + Math.cos(t * 1.1 + this.pPhase[i]) * sway * 0.03) * dt;
        if (s.inside(nx, ny, nz)) { x = nx; y = ny; z = nz; }
        else if (!rise && (vx * g.x + vy * g.y + vz * g.z) > 0.02 && !upright) {
          // 重力の向きに進んで壁に当たった → 壁に沿って一番低いところまで滑り、そこで積もる
          const cy = (s.groundY + s.topY) / 2;
          const sx = x + (0 - x) * 0.05 + g.x * 0.03, sy = y + (cy - y) * 0.05 + g.y * 0.03, sz = z + (0 - z) * 0.05 + g.z * 0.03;
          if (s.inside(sx, sy, sz) && ((sx - x) * g.x + (sy - y) * g.y + (sz - z) * g.z) > 0.0008) { x = sx; y = sy; z = sz; }
          else this.pSettled[i] = 2;
        } else if (spreading) {
          // 散らしている最中は壁で押し戻さず、目標へまっすぐ置く
          x = this.pTarget[o]; y = this.pTarget[o + 1]; z = this.pTarget[o + 2];
        } else {
          this.pv[o] *= -0.3; this.pv[o + 1] *= -0.3; this.pv[o + 2] *= -0.3;
          const cy = (s.groundY + s.topY) / 2;
          x *= 0.985; z *= 0.985; y = (y - cy) * 0.985 + cy;
        }
        if (!rise && upright && y <= this.pRest[i]) {
          y = this.pRest[i];
          if (s.inside(x, s.groundY + 0.06, z)) this.pSettled[i] = 1;
        }
        if (!rise && !upright && g.y < 0 && y <= this.pRest[i]) {
          // 斜めの時も雪面より下には潜らない
          y = this.pRest[i];
        }
        if (rise && y > s.topY - 0.15) {
          const [rx, , rz] = this._randomInside(s.groundY);
          x = rx; z = rz; y = s.groundY + 0.05;
        }
      } else {
        a *= 0.9;
      }
      pos.array[o] = x; pos.array[o + 1] = y; pos.array[o + 2] = z;
      alpha.array[i] = a;
    }
    pos.needsUpdate = true;
    alpha.needsUpdate = true;
  }

  _settleTilt() {
    const a = this.flipAngle;
    const turns = Math.round(a / (Math.PI * 2));
    const rel = a - turns * Math.PI * 2;                 // -π..π
    const nearDown = Math.abs(Math.abs(rel) - Math.PI) < 0.6;
    const target = turns * Math.PI * 2 + (nearDown ? Math.sign(rel || 1) * Math.PI : 0);
    this.upsideDown = nearDown;
    this.flipFrom = a; this.flipTo = target; this.flipT = 0; this.flipDur = 0.9;
  }

  // 逆さまにする / 元に戻す
  flip(upsideDown = !this.upsideDown) {
    if (upsideDown === this.upsideDown && this.flipT >= 1) return this.upsideDown;
    this.upsideDown = upsideDown;
    this.flipFrom = this.flipAngle;
    const turns = Math.round(this.flipAngle / (Math.PI * 2));
    this.flipTo = turns * Math.PI * 2 + (upsideDown ? Math.PI : 0);
    this.flipDur = 1.3;
    this.flipT = 0;
    // 積もっていた雪をはがして、新しい重力で落ち直させる
    for (let i = 0; i < this.pCount; i++) {
      this.pSettled[i] = 0;
      this.pv[i * 3] = (Math.random() - 0.5) * 0.3;
      this.pv[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      this.pv[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    return upsideDown;
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
