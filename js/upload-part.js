// ============================================================
// じぶんのパーツ（画像アップロード）
//
//  ・白い紙に描いた絵をスマホで撮る、という使い方を想定。
//    画像のフチから外へつながっている「似た色」をたどって消すので、
//    背景が白や単色なら、だいたいそれだけで切り抜けます。
//  ・残ったところは指でなぞって消せます（戻すこともできます）。
//  ・作ったパーツはその端末の中だけに保存します（localStorage）。
//    サーバーにもDriveにも送りません。
// ============================================================

const MyParts = (function () {
  const KEY = 'tcm_snowdome_my_parts_v1';
  const MAX_PARTS = 12;      // 1端末あたりの保存数
  const MAX_SIDE = 320;      // パーツ画像の長辺（これ以上は縮める）

  // ───────── 保存（端末の中だけ） ─────────
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((p) => p && p.img) : [];
    } catch (e) { return []; }   // プライベートモードなどで読めないことがある
  }

  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }

  function syncCatalog() {
    PARTS_CATALOG.mine = load().map((p) => ({
      id: p.id, name: p.name, img: p.img, w: p.w, h: p.h,
      trueColor: true,   // 元の色のまま置きたいので磁器風の補正はかけない
      custom: true,      // ギャラリー投稿時の目印
    }));
    return PARTS_CATALOG.mine;
  }

  function remove(id) {
    save(load().filter((p) => p.id !== id));
    syncCatalog();
  }

  // ───────── 背景を消す ─────────
  // フチの画素を出発点に、似た色がつながっている範囲をたどって透明にする。
  // 真ん中にある同じ色（キャラの白い部分など）は、外とつながっていないので残る。
  function removeBackground(src, tolerance) {
    const { width: W, height: H } = src;
    const d = new Uint8ClampedArray(src.data);
    const seen = new Uint8Array(W * H);
    const queue = [];
    const tol2 = tolerance * tolerance * 3;

    const push = (x, y, r, g, b) => {
      const i = y * W + x;
      if (seen[i]) return;
      const o = i * 4;
      if (d[o + 3] === 0) { seen[i] = 1; queue.push(i, r, g, b); return; }
      const dr = d[o] - r, dg = d[o + 1] - g, db = d[o + 2] - b;
      if (dr * dr + dg * dg + db * db > tol2) return;
      seen[i] = 1;
      queue.push(i, r, g, b);
    };

    // フチをぜんぶ出発点にする（その画素自身の色を基準にする）
    for (let x = 0; x < W; x++) {
      for (const y of [0, H - 1]) {
        const o = (y * W + x) * 4;
        push(x, y, d[o], d[o + 1], d[o + 2]);
      }
    }
    for (let y = 0; y < H; y++) {
      for (const x of [0, W - 1]) {
        const o = (y * W + x) * 4;
        push(x, y, d[o], d[o + 1], d[o + 2]);
      }
    }

    for (let q = 0; q < queue.length; q += 4) {
      const i = queue[q], r = queue[q + 1], g = queue[q + 2], b = queue[q + 3];
      d[i * 4 + 3] = 0;
      const x = i % W, y = (i / W) | 0;
      if (x > 0) push(x - 1, y, r, g, b);
      if (x < W - 1) push(x + 1, y, r, g, b);
      if (y > 0) push(x, y - 1, r, g, b);
      if (y < H - 1) push(x, y + 1, r, g, b);
    }

    // 境目を1段やわらげる（ジャギーと白フチを目立たなくする）
    const out = new Uint8ClampedArray(d);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (d[i * 4 + 3] === 0) continue;
        let open = 0;
        if (d[(i - 1) * 4 + 3] === 0) open++;
        if (d[(i + 1) * 4 + 3] === 0) open++;
        if (d[(i - W) * 4 + 3] === 0) open++;
        if (d[(i + W) * 4 + 3] === 0) open++;
        if (open) out[i * 4 + 3] = Math.round(255 * (1 - open / 5));
      }
    }
    return new ImageData(out, W, H);
  }

  function hasAlpha(img) {
    let n = 0;
    for (let i = 3; i < img.data.length; i += 4 * 17) if (img.data[i] < 200) n++;
    return n > (img.data.length / (4 * 17)) * 0.03;
  }

  function trim(ctx, W, H) {
    const d = ctx.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (d[(y * W + x) * 4 + 3] > 12) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // ───────── 編集画面 ─────────
  let el = {};      // モーダル内の要素
  let srcCanvas;    // 元画像（縮めたもの）
  let workCanvas;   // 編集中
  let baseData;     // 背景を消した直後の状態（「戻す」ブラシの参照元）
  let onDone;

  function build() {
    if (el.root) return;
    const root = document.createElement('div');
    root.className = 'modal-overlay';
    root.id = 'myPartModal';
    root.innerHTML = `
      <div class="modal mypart-modal">
        <button class="modal-close" id="mpClose">×</button>
        <h2>じぶんのパーツを作る</h2>
        <p class="modal-sub">Eigene Figur</p>
        <div class="mp-stage"><canvas id="mpCanvas"></canvas></div>
        <div class="mp-row">
          <label for="mpTol">背景を消す強さ</label>
          <input type="range" id="mpTol" min="8" max="110" value="42">
          <button class="btn btn-sm" id="mpReset">やりなおす</button>
        </div>
        <div class="mp-row">
          <span class="mp-label">指でなおす</span>
          <div class="mp-tools">
            <button type="button" class="mp-tool active" data-tool="erase">消す</button>
            <button type="button" class="mp-tool" data-tool="restore">戻す</button>
          </div>
          <input type="range" id="mpBrush" min="6" max="56" value="22" aria-label="ブラシの大きさ">
        </div>
        <div class="form-group">
          <label for="mpName">パーツの名前</label>
          <input type="text" id="mpName" maxlength="16" placeholder="例：うちの犬">
          <p class="ng-note" id="mpNgNote" role="alert" hidden></p>
        </div>
        <p class="mp-note">他の人が描いたキャラクターや、知らない人が写っている写真は入れないでください。</p>
        <div class="modal-actions">
          <button class="btn" id="mpCancel">やめる</button>
          <button class="btn btn-primary" id="mpSave">パーツにする</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    el = {
      root, canvas: root.querySelector('#mpCanvas'), tol: root.querySelector('#mpTol'),
      brush: root.querySelector('#mpBrush'), name: root.querySelector('#mpName'),
      note: root.querySelector('#mpNgNote'),
    };
    el.ctx = el.canvas.getContext('2d', { willReadFrequently: true });

    root.querySelector('#mpClose').addEventListener('click', close);
    root.querySelector('#mpCancel').addEventListener('click', close);
    root.querySelector('#mpReset').addEventListener('click', () => applyRemoval());
    root.querySelector('#mpSave').addEventListener('click', commit);
    el.tol.addEventListener('input', () => applyRemoval());
    root.querySelectorAll('.mp-tool').forEach((b) => b.addEventListener('click', () => {
      root.querySelectorAll('.mp-tool').forEach((x) => x.classList.toggle('active', x === b));
    }));
    bindBrush();
  }

  function currentTool() {
    const b = el.root.querySelector('.mp-tool.active');
    return b ? b.dataset.tool : 'erase';
  }

  function bindBrush() {
    let drawing = false;
    const at = (e) => {
      const r = el.canvas.getBoundingClientRect();
      return [(e.clientX - r.left) * (el.canvas.width / r.width), (e.clientY - r.top) * (el.canvas.height / r.height)];
    };
    const paint = (e) => {
      const [x, y] = at(e);
      const rad = Number(el.brush.value) * (el.canvas.width / el.canvas.getBoundingClientRect().width) / 2;
      el.ctx.save();
      if (currentTool() === 'erase') {
        el.ctx.globalCompositeOperation = 'destination-out';
        el.ctx.beginPath(); el.ctx.arc(x, y, rad, 0, Math.PI * 2); el.ctx.fill();
      } else {
        // 消しすぎたところに、背景を消した直後の絵を塗り戻す
        el.ctx.beginPath(); el.ctx.arc(x, y, rad, 0, Math.PI * 2); el.ctx.clip();
        el.ctx.putImageData(baseData, 0, 0, x - rad, y - rad, rad * 2, rad * 2);
      }
      el.ctx.restore();
    };
    el.canvas.addEventListener('pointerdown', (e) => {
      drawing = true; el.canvas.setPointerCapture(e.pointerId); paint(e); e.preventDefault();
    });
    el.canvas.addEventListener('pointermove', (e) => { if (drawing) { paint(e); e.preventDefault(); } });
    const end = () => { drawing = false; };
    el.canvas.addEventListener('pointerup', end);
    el.canvas.addEventListener('pointercancel', end);
  }

  function applyRemoval() {
    const W = srcCanvas.width, H = srcCanvas.height;
    el.ctx.clearRect(0, 0, W, H);
    el.ctx.drawImage(srcCanvas, 0, 0);
    const img = el.ctx.getImageData(0, 0, W, H);
    const out = hasAlpha(img) ? img : removeBackground(img, Number(el.tol.value));
    el.ctx.putImageData(out, 0, 0);
    baseData = el.ctx.getImageData(0, 0, W, H);
  }

  async function open(file, done) {
    build();
    onDone = done;
    const url = URL.createObjectURL(file);
    let img;
    try { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
    catch (e) { URL.revokeObjectURL(url); showToast('画像を読み込めませんでした'); return; }
    URL.revokeObjectURL(url);

    const s = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    srcCanvas = document.createElement('canvas');
    srcCanvas.width = Math.max(1, Math.round(img.width * s));
    srcCanvas.height = Math.max(1, Math.round(img.height * s));
    srcCanvas.getContext('2d').drawImage(img, 0, 0, srcCanvas.width, srcCanvas.height);

    el.canvas.width = srcCanvas.width;
    el.canvas.height = srcCanvas.height;
    el.name.value = '';
    el.note.hidden = true;
    applyRemoval();
    el.root.classList.add('open');
  }

  function close() {
    el.root.classList.remove('open');
    srcCanvas = baseData = null;
  }

  function commit() {
    const name = el.name.value.trim() || 'じぶんのパーツ';
    const r = NGWords.check(name);
    if (!r.ok) { el.note.textContent = r.reason; el.note.hidden = false; return; }
    el.note.hidden = true;

    const W = el.canvas.width, H = el.canvas.height;
    const box = trim(el.ctx, W, H);
    if (!box || box.w < 8 || box.h < 8) { showToast('全部消えてしまっています'); return; }

    const cut = document.createElement('canvas');
    cut.width = box.w; cut.height = box.h;
    cut.getContext('2d').drawImage(el.canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);

    const list = load();
    if (list.length >= MAX_PARTS) list.shift();   // 古いものから入れ替え
    const s = 150 / Math.max(box.w, box.h);
    list.push({
      id: 'my-' + Date.now().toString(36),
      name, img: cut.toDataURL('image/webp', 0.9),
      w: Math.round(box.w * s), h: Math.round(box.h * s),
    });
    if (!save(list)) { showToast('この端末には保存できませんでした'); return; }
    syncCatalog();
    close();
    showToast(`「${name}」を追加しました`);
    if (typeof onDone === 'function') onDone();
  }

  return { load, remove, syncCatalog, open, MAX_PARTS };
})();

if (typeof window !== 'undefined') window.MyParts = MyParts;
