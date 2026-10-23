// ============================================================
// SNS共有・ギャラリーへの追加
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

// 端末ごとの匿名ID（連投防止用）
function _snowdomeClientId() {
  try {
    let id = localStorage.getItem('tcm_snowdome_client');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9]/g, '');
      localStorage.setItem('tcm_snowdome_client', id);
    }
    return id;
  } catch (e) { return ''; }
}

// ───────── ギャラリー追加モーダル ─────────
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
  for (const [label, text] of [['ニックネーム', name], ['コメント', comment]]) {
    const r = NGWords.check(text);
    if (!r.ok) { showToast(`${label}：${r.reason}`); return; }
  }
  if (typeof window.engravingIsClean === 'function' && !window.engravingIsClean()) {
    showToast('台座の刻印に使えない言葉が含まれています'); return;
  }
  if (!consent) { showToast('規約への同意が必要です'); return; }
  if (!dataUrl) { showToast('画像の生成に失敗しています'); return; }

  const btn = document.getElementById('btnSubmitContest');
  btn.disabled = true;
  btn.textContent = '送信中...';

  try {
    // GAS WebApp は URLエンコード形式で送る（CORSプリフライト回避・e.parameter で受け取れる）
    const body = new URLSearchParams();
    body.append('action', 'submit');
    body.append('name', name);
    body.append('comment', comment);
    body.append('image', dataUrl); // dataURL のまま送信
    body.append('ua', navigator.userAgent);
    body.append('client', _snowdomeClientId());

    if (!CONFIG.GAS_WEBAPP_URL || CONFIG.GAS_WEBAPP_URL.includes('REPLACE_WITH')) { throw new Error('ギャラリーへの追加は準備中です'); }
    const res = await fetch(CONFIG.GAS_WEBAPP_URL, { method: 'POST', body });
    const result = await res.json();

    if (result.ok) {
      closeContestModal();
      document.getElementById('postSuccessModal').classList.add('open');
      document.getElementById('postShareUrl').textContent = result.shareUrl || CONFIG.SITE_URL;
      document.getElementById('postShareUrl').href = result.shareUrl || CONFIG.SITE_URL;
    } else {
      showToast('追加できませんでした: ' + (result.error || ''));
    }
  } catch (err) {
    console.error(err);
    showToast('追加できませんでした。ネットワークを確認してください');
  } finally {
    btn.disabled = false;
    btn.textContent = 'ギャラリーに追加';
  }
}

function closePostSuccess() {
  document.getElementById('postSuccessModal').classList.remove('open');
}

// 追加できたあと、Xに共有
function sharePostToX() {
  const url = document.getElementById('postShareUrl').href;
  const tags = CONFIG.HASHTAGS.join(' #');
  const text = `東京クリスマスマーケットのスノードームを作りました❄️\n#${tags}`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(shareUrl, '_blank', 'noopener,noreferrer');
}
