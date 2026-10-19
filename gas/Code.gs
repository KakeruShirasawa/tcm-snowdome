/**
 * ============================================================
 * 東京クリスマスマーケット スノードームコンテスト GAS Backend
 *
 * 【セットアップ手順】
 * 1. 新規Googleスプレッドシートを作成
 * 2. 「拡張機能」→「Apps Script」を開く
 * 3. このコードを貼り付ける
 * 4. 下の CONFIG の DRIVE_FOLDER_ID を自分の Google Drive フォルダIDに置き換え
 *    （スノードーム画像を保存する専用フォルダを事前に作成）
 * 5. 「デプロイ」→「新しいデプロイ」→種類「ウェブアプリ」
 *    - 次のユーザーとして実行：自分
 *    - アクセス権：全員
 * 6. 発行されたURLを snowdome/js/config.js の GAS_WEBAPP_URL に設定
 * ============================================================
 */

const CONFIG = {
  DRIVE_FOLDER_ID: '1xy01RM9famhNIIC8kNp3mDr68svYSwkm', // ★要設定
  SHEET_NAME: 'posts',                                   // 投稿データシート
  LIKES_SHEET_NAME: 'likes',                             // いいねシート
  AUTO_APPROVE: false,                                    // true=即公開、false=手動承認
  SITE_URL: 'https://tokyochristmas.jp/snowdome/',       // 公開サイトURL
};

/**
 * メインエントリ：POST
 * 投稿画像の受け付け
 */
function doPost(e) {
  try {
    const params = e.parameter;
    const action = params.action;

    if (action === 'submit') return _submitPost(params);
    if (action === 'like') return _toggleLike(params);
    return _json({ ok: false, error: 'unknown action' });
  } catch (err) {
    console.error(err);
    return _json({ ok: false, error: String(err) });
  }
}

/**
 * メインエントリ：GET
 * ギャラリー取得
 */
function doGet(e) {
  try {
    const params = e.parameter;
    const action = params.action || 'list';

    if (action === 'list') return _listPosts(params);
    if (action === 'detail') return _detailPost(params);
    return _json({ ok: false, error: 'unknown action' });
  } catch (err) {
    console.error(err);
    return _json({ ok: false, error: String(err) });
  }
}

/**
 * 投稿の保存
 */
function _submitPost(params) {
  const name = (params.name || '').toString().trim().slice(0, 20);
  const comment = (params.comment || '').toString().trim().slice(0, 140);
  const imageDataUrl = params.image;
  const ua = (params.ua || '').toString().slice(0, 200);

  if (!name) return _json({ ok: false, error: 'name required' });
  if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
    return _json({ ok: false, error: 'invalid image' });
  }

  // DataURL -> Blob
  const matches = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!matches) return _json({ ok: false, error: 'invalid dataurl' });
  const mime = matches[1];
  const b64 = matches[2];
  if (mime !== 'image/png' && mime !== 'image/jpeg') return _json({ ok: false, error: 'unsupported image' });
  if (b64.length > 8 * 1024 * 1024) return _json({ ok: false, error: 'image too large' });
  const bytes = Utilities.base64Decode(b64);
  const ext = mime === 'image/png' ? 'png' : (mime === 'image/jpeg' ? 'jpg' : 'bin');

  const id = Utilities.getUuid();
  const timestamp = new Date();
  const filename = `tcm_snowdome_${Utilities.formatDate(timestamp, 'Asia/Tokyo', 'yyyyMMdd_HHmmss')}_${id.slice(0, 6)}.${ext}`;

  // Drive に保存
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const blob = Utilities.newBlob(bytes, mime, filename);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileId = file.getId();
  // 画像を直接表示できる URL
  const imageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

  // スプシに記録
  const sheet = _getSheet(CONFIG.SHEET_NAME);
  // 列: id | timestamp | name | comment | fileId | imageUrl | status | likes | ua
  sheet.appendRow([
    id,
    timestamp,
    name,
    comment,
    fileId,
    imageUrl,
    CONFIG.AUTO_APPROVE ? 'approved' : 'pending',
    0,
    ua,
  ]);

  const shareUrl = `${CONFIG.SITE_URL}gallery.html?id=${id}`;

  return _json({
    ok: true,
    id,
    imageUrl,
    shareUrl,
  });
}

/**
 * 投稿一覧の取得
 * params:
 *   limit: 件数（最大50）
 *   offset: 開始位置
 *   sort: 'new' | 'popular'
 */
function _listPosts(params) {
  const limit = Math.min(parseInt(params.limit || '24', 10), 50);
  const offset = parseInt(params.offset || '0', 10);
  const sort = params.sort || 'new';

  const sheet = _getSheet(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return _json({ ok: true, items: [], total: 0 });
  const rows = data.slice(1);

  // 承認済みのみ
  let items = rows
    .filter(r => r[6] === 'approved')
    .map(r => ({
      id: r[0],
      timestamp: new Date(r[1]).getTime(),
      name: r[2],
      comment: r[3],
      imageUrl: r[5],
      likes: Number(r[7]) || 0,
    }));

  if (sort === 'popular') {
    items.sort((a, b) => b.likes - a.likes || b.timestamp - a.timestamp);
  } else {
    items.sort((a, b) => b.timestamp - a.timestamp);
  }

  const total = items.length;
  items = items.slice(offset, offset + limit);

  return _json({ ok: true, items, total });
}

/**
 * 1件詳細
 */
function _detailPost(params) {
  const id = (params.id || '').toString();
  if (!id) return _json({ ok: false, error: 'id required' });

  const sheet = _getSheet(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  const r = rows.find(x => x[0] === id && x[6] === 'approved');
  if (!r) return _json({ ok: false, error: 'not found' });

  return _json({
    ok: true,
    item: {
      id: r[0],
      timestamp: new Date(r[1]).getTime(),
      name: r[2],
      comment: r[3],
      imageUrl: r[5],
      likes: Number(r[7]) || 0,
    },
  });
}

/**
 * いいね切替
 */
function _toggleLike(params) {
  const postId = (params.id || '').toString();
  const voterId = (params.voter || '').toString().slice(0, 64);
  const op = params.op || 'add'; // add | remove

  if (!postId || !voterId) return _json({ ok: false, error: 'params required' });

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const likesSheet = _getLikesSheet();
    const data = likesSheet.getDataRange().getValues();
    const rows = data.slice(1);
    const existing = rows.findIndex(r => r[0] === postId && r[1] === voterId);

    const postsSheet = _getSheet(CONFIG.SHEET_NAME);
    const postData = postsSheet.getDataRange().getValues();
    const postIdx = postData.slice(1).findIndex(r => r[0] === postId);
    if (postIdx < 0) return _json({ ok: false, error: 'post not found' });

    let likes = Number(postData[postIdx + 1][7]) || 0;

    if (op === 'add' && existing < 0) {
      likesSheet.appendRow([postId, voterId, new Date()]);
      likes++;
    } else if (op === 'remove' && existing >= 0) {
      likesSheet.deleteRow(existing + 2);
      likes = Math.max(0, likes - 1);
    }

    postsSheet.getRange(postIdx + 2, 8).setValue(likes);
    return _json({ ok: true, likes });
  } finally {
    lock.releaseLock();
  }
}

// ───────── ヘルパー ─────────
function _getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(['id', 'timestamp', 'name', 'comment', 'fileId', 'imageUrl', 'status', 'likes', 'ua']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _getLikesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.LIKES_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.LIKES_SHEET_NAME);
    sh.appendRow(['postId', 'voterId', 'timestamp']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 動作確認用：管理者が実行すると最新5件をログ出力
 */
function debug_listRecent() {
  const sheet = _getSheet(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  console.log(data.slice(0, 6));
}
