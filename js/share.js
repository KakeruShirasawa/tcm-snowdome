// ============================================================
// SNS共有・コンテスト投稿
// ============================================================

function shareToX() {
  const tags = CONFIG.HASHTAGS.join(' #');
  const text = `東京クリスマスマーケットのスノードームメーカーで作ったよ❄️\n#${tags}`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(CONFIG.SITE_URL)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function shareToLine() {
  const text = `東京クリスマスマーケット スノードームメーカー\n${CONFIG.SITE_URL}`;
  const url = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(CONFIG.SITE_URL)}&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ───────── コンテスト投稿モーダル ─────────
function openContestModal() {
  document.getElementById('contestModal').classList.add('open');
  // プレビュー用に書き出し
  exportToPNG().then(dataUrl => {
    document.getElementById('contestPreview').src = dataUrl;
    document.getElementById('contestPreview').dataset.dataUrl = dataUrl;
  }).catch(err => {
    console.error(err);
    showToast('プレビュー作成に失敗しました');
  });
}

function closeContestModal() {
  document.getElementById('contestModal').classList.remove('open');
}

async function submitContest() {
  const name = document.getElementById('contestName').value.trim();
  const comment = document.getElementById('contestComment').value.trim();
  const consent = document.getElementById('contestConsent').checked;
  const dataUrl = document.getElementById('contestPreview').dataset.dataUrl;

  if (!name) { showToast('ニックネームを入力してください'); return; }
  if (!consent) { showToast('規約への同意が必要です'); return; }
  if (!dataUrl) { showToast('画像の生成に失敗しています'); return; }

  const btn = document.getElementById('btnSubmitContest');
  btn.disabled = true;
  btn.textContent = '送信中...';

  try {
    // GAS WebApp は FormData の方が CORS プリフライトを回避できる
    const fd = new FormData();
    fd.append('action', 'submit');
    fd.append('name', name);
    fd.append('comment', comment);
    fd.append('image', dataUrl); // dataURL のまま送信
    fd.append('ua', navigator.userAgent);

    if (!CONFIG.GAS_WEBAPP_URL || CONFIG.GAS_WEBAPP_URL.includes('REPLACE_WITH')) { throw new Error('コンテスト投稿は準備中です'); }
    const res = await fetch(CONFIG.GAS_WEBAPP_URL, { method: 'POST', body: fd });
    const result = await res.json();

    if (result.ok) {
      closeContestModal();
      document.getElementById('postSuccessModal').classList.add('open');
      document.getElementById('postShareUrl').textContent = result.shareUrl || CONFIG.SITE_URL;
      document.getElementById('postShareUrl').href = result.shareUrl || CONFIG.SITE_URL;
    } else {
      showToast('投稿に失敗しました: ' + (result.error || ''));
    }
  } catch (err) {
    console.error(err);
    showToast('投稿エラー。ネットワークを確認してください');
  } finally {
    btn.disabled = false;
    btn.textContent = 'コンテストに投稿する';
  }
}

function closePostSuccess() {
  document.getElementById('postSuccessModal').classList.remove('open');
}

// 投稿成功後、Xに共有
function sharePostToX() {
  const url = document.getElementById('postShareUrl').href;
  const tags = CONFIG.HASHTAGS.join(' #');
  const text = `東京クリスマスマーケット スノードームコンテストに投稿しました❄️\n#${tags}`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(shareUrl, '_blank', 'noopener,noreferrer');
}
