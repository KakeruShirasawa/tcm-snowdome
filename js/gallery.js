// ============================================================
// コンテストギャラリー
// ============================================================

const Gallery = {
  items: [],
  total: 0,
  offset: 0,
  sort: 'new',
  loading: false,
  voterId: null,
  likedSet: new Set(),
};

document.addEventListener('DOMContentLoaded', () => {
  Gallery.voterId = _getVoterId();
  _loadLikedFromStorage();
  _bindSortTabs();
  loadMore();
  _bindLoadMore();
  // URL ?id=xxx で単件詳細
  const q = new URLSearchParams(location.search);
  if (q.get('id')) openDetailById(q.get('id'));
});

function _getVoterId() {
  let v = localStorage.getItem('tcm_voter_id');
  if (!v) {
    v = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('tcm_voter_id', v);
  }
  return v;
}

function _loadLikedFromStorage() {
  const raw = localStorage.getItem('tcm_liked');
  if (raw) {
    try { Gallery.likedSet = new Set(JSON.parse(raw)); } catch(e) {}
  }
}

function _saveLikedToStorage() {
  localStorage.setItem('tcm_liked', JSON.stringify([...Gallery.likedSet]));
}

function _bindSortTabs() {
  document.querySelectorAll('.sort-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (Gallery.sort === btn.dataset.sort) return;
      Gallery.sort = btn.dataset.sort;
      document.querySelectorAll('.sort-tabs button').forEach(b => b.classList.toggle('active', b === btn));
      Gallery.items = [];
      Gallery.offset = 0;
      document.getElementById('galleryGrid').innerHTML = '';
      loadMore();
    });
  });
}

function _bindLoadMore() {
  document.getElementById('loadMoreBtn').addEventListener('click', loadMore);
}

async function loadMore() {
  if (Gallery.loading) return;
  Gallery.loading = true;
  _setLoading(true);
  try {
    if (!CONFIG.GAS_WEBAPP_URL) { throw new Error('ギャラリーは準備中です'); }
    const url = `${CONFIG.GAS_WEBAPP_URL}?action=list&sort=${Gallery.sort}&offset=${Gallery.offset}&limit=${CONFIG.GALLERY_PAGE_SIZE}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    Gallery.items.push(...data.items);
    Gallery.total = data.total;
    Gallery.offset += data.items.length;
    _renderBatch(data.items);
    _updateCountAndMore();
  } catch (err) {
    console.error(err);
    _renderError(err);
  } finally {
    Gallery.loading = false;
    _setLoading(false);
  }
}

function _renderBatch(items) {
  const grid = document.getElementById('galleryGrid');
  // 初回で0件
  if (grid.children.length === 0 && items.length === 0) {
    grid.innerHTML = `<div class="gallery-empty" style="grid-column: 1 / -1;">
      <p style="font-size: 48px; margin: 0;">❄</p>
      <p>まだ投稿がありません。<br>最初の作品を投稿してみよう！</p>
      <a href="index.html" class="btn btn-primary" style="margin-top: 16px;">スノードームを作る</a>
    </div>`;
    return;
  }

  for (const it of items) {
    const el = document.createElement('div');
    el.className = 'gcard';
    el.dataset.id = it.id;
    const liked = Gallery.likedSet.has(it.id);
    const date = new Date(it.timestamp);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    el.innerHTML = `
      <img class="gcard-img" src="${it.imageUrl}" alt="${_esc(it.name)}の作品" loading="lazy">
      <div class="gcard-body">
        <div class="gcard-name">${_esc(it.name)}</div>
        <div class="gcard-comment">${_esc(it.comment || '　')}</div>
      </div>
      <div class="gcard-foot">
        <button class="like-btn ${liked ? 'liked' : ''}" data-id="${it.id}">
          <span>${liked ? '♥' : '♡'}</span><span class="count">${it.likes}</span>
        </button>
        <span class="gcard-date">${dateStr}</span>
      </div>
    `;
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('.like-btn')) return;
      openDetail(it);
    });
    el.querySelector('.like-btn').addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleLike(it.id, ev.currentTarget);
    });
    document.getElementById('galleryGrid').appendChild(el);
  }
}

function _updateCountAndMore() {
  document.getElementById('galleryCount').textContent = `全 ${Gallery.total} 件 / 表示中 ${Gallery.offset}`;
  document.getElementById('loadMoreBtn').style.display = Gallery.offset < Gallery.total ? '' : 'none';
}

function _setLoading(on) {
  document.getElementById('galleryLoading').style.display = on ? '' : 'none';
}

function _renderError(err) {
  document.getElementById('galleryGrid').insertAdjacentHTML('beforeend',
    `<div class="gallery-empty" style="grid-column: 1 / -1;">読み込みに失敗しました。<br>${_esc(String(err))}</div>`);
}

async function toggleLike(id, btn) {
  const liked = Gallery.likedSet.has(id);
  const op = liked ? 'remove' : 'add';
  // 楽観更新
  const countEl = btn.querySelector('.count');
  const current = parseInt(countEl.textContent, 10) || 0;
  countEl.textContent = liked ? Math.max(0, current - 1) : current + 1;
  btn.querySelector('span:first-child').textContent = liked ? '♡' : '♥';
  btn.classList.toggle('liked', !liked);

  if (liked) Gallery.likedSet.delete(id); else Gallery.likedSet.add(id);
  _saveLikedToStorage();

  try {
    const fd = new FormData();
    fd.append('action', 'like');
    fd.append('id', id);
    fd.append('voter', Gallery.voterId);
    fd.append('op', op);
    const res = await fetch(CONFIG.GAS_WEBAPP_URL, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.ok) countEl.textContent = data.likes;
  } catch (err) {
    console.error(err);
  }
}

// ───────── 詳細 ─────────
function openDetail(it) {
  const m = document.getElementById('detailModal');
  m.querySelector('.detail-img').src = it.imageUrl;
  m.querySelector('.detail-name').textContent = it.name;
  m.querySelector('.detail-comment').textContent = it.comment || '';
  const shareUrl = `${location.origin}${location.pathname}?id=${it.id}`;
  m.querySelector('[data-share-x]').onclick = () => {
    const text = `${it.name}さんのスノードーム素敵！\n#東京クリスマスマーケット #TCMスノードーム`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener');
  };
  m.querySelector('[data-copy-link]').onclick = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      m.querySelector('[data-copy-link]').textContent = 'コピーしました';
      setTimeout(() => m.querySelector('[data-copy-link]').textContent = 'リンクをコピー', 1500);
    });
  };
  m.classList.add('open');
}

async function openDetailById(id) {
  try {
    const res = await fetch(`${CONFIG.GAS_WEBAPP_URL}?action=detail&id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (data.ok) openDetail(data.item);
  } catch (err) { console.error(err); }
}

function closeDetail() {
  document.getElementById('detailModal').classList.remove('open');
  // URLからid削除
  if (location.search.includes('id=')) {
    history.replaceState(null, '', location.pathname);
  }
}

function _esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
