/**
 * ============================================================
 * 東京クリスマスマーケット2026 スノードームコンテスト GAS Backend
 *
 * ・投稿画像は Drive フォルダ（DRIVE_FOLDER_ID）に保存
 * ・投稿データ／いいねはスプレッドシート（スクリプトプロパティ SPREADSHEET_ID）に保存
 * ・投稿は status=pending で入り、スプレッドシートで approved に変えるとギャラリーに出ます
 *   （rejected = 非掲載）
 *
 * 【初回セットアップ】
 * 1. setup() をエディタから実行（シート作成・承認プルダウン設定）
 * 2. デプロイ →「ウェブアプリ」／次のユーザーとして実行：自分／アクセス：全員
 * 3. 発行URLを js/config.js の GAS_WEBAPP_URL に設定
 * ============================================================
 */

const CONFIG = {
  DRIVE_FOLDER_ID: '1NwSRlpXpAKiIAAeYmRCwGiu1Q4l2UwII',
  DEFAULT_SPREADSHEET_ID: '15UZ1kX9cG54Uc2ChgnfTXmqdUu04OhKgIuqo9gLAJ04',
  SHEET_NAME: 'posts',
  LIKES_SHEET_NAME: 'likes',
  AUTO_APPROVE: false,            // true = 即公開 / false = 手動承認
  SITE_URL: 'https://kakerushirasawa.github.io/tcm-snowdome/',
  MAX_IMAGE_B64: 6 * 1024 * 1024, // base64文字数の上限（約4.5MB）
  SUBMIT_COOLDOWN_SEC: 60,        // 同一端末からの連投間隔
  DAILY_SUBMIT_CAP: 3000,         // 1日の投稿上限（荒らし対策）
};

const STATUS = ['pending', 'approved', 'rejected'];
const COL = { id: 1, timestamp: 2, name: 3, comment: 4, fileId: 5, imageUrl: 6, status: 7, likes: 8, ua: 9 };

// ───────── エントリポイント ─────────
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.action === 'submit') return _submitPost(p);
    if (p.action === 'like') return _toggleLike(p);
    return _json({ ok: false, error: 'unknown action' });
  } catch (err) {
    console.error(err);
    return _json({ ok: false, error: 'server error' });
  }
}

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || 'list';
    if (action === 'list') return _listPosts(p);
    if (action === 'detail') return _detailPost(p);
    if (action === 'ping') return _json({ ok: true, service: 'tcm-snowdome' });
    return _json({ ok: false, error: 'unknown action' });
  } catch (err) {
    console.error(err);
    return _json({ ok: false, error: 'server error' });
  }
}

// ───────── 投稿 ─────────
function _submitPost(p) {
  const name = _clean(p.name, 20);
  const comment = _clean(p.comment, 140);
  const ua = _clean(p.ua, 200);
  const client = _clean(p.client, 64);
  const dataUrl = String(p.image || '');

  if (!name) return _json({ ok: false, error: 'ニックネームを入力してください' });
  if (_hasNg(name) || _hasNg(comment)) return _json({ ok: false, error: '使えない言葉が含まれています' });

  const m = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return _json({ ok: false, error: '画像形式が不正です' });
  const mime = m[1];
  const b64 = m[2];
  if (b64.length > CONFIG.MAX_IMAGE_B64) return _json({ ok: false, error: '画像サイズが大きすぎます' });

  const bytes = Utilities.base64Decode(b64);
  if (!_isImageBytes(bytes, mime)) return _json({ ok: false, error: '画像形式が不正です' });

  // 連投・荒らし対策
  const cache = CacheService.getScriptCache();
  const who = _hash((client || ua) + '|' + name);
  if (cache.get('cool_' + who)) return _json({ ok: false, error: '少し時間をおいてから投稿してください' });
  const dayKey = 'day_' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');
  const today = Number(cache.get(dayKey) || 0);
  if (today >= CONFIG.DAILY_SUBMIT_CAP) return _json({ ok: false, error: '本日の受付上限に達しました' });

  const id = Utilities.getUuid();
  const now = new Date();
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const filename = 'tcm_snowdome_' + Utilities.formatDate(now, 'Asia/Tokyo', 'yyyyMMdd_HHmmss') + '_' + id.slice(0, 6) + '.' + ext;

  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const file = folder.createFile(Utilities.newBlob(bytes, mime, filename));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileId = file.getId();
  const imageUrl = 'https://lh3.googleusercontent.com/d/' + fileId;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    _getSheet(CONFIG.SHEET_NAME).appendRow([
      id, now, _sheetText(name), _sheetText(comment), fileId, imageUrl,
      CONFIG.AUTO_APPROVE ? 'approved' : 'pending', 0, _sheetText(ua),
    ]);
  } finally {
    lock.releaseLock();
  }

  cache.put('cool_' + who, '1', CONFIG.SUBMIT_COOLDOWN_SEC);
  cache.put(dayKey, String(today + 1), 6 * 60 * 60);

  return _json({
    ok: true,
    id: id,
    status: CONFIG.AUTO_APPROVE ? 'approved' : 'pending',
    imageUrl: imageUrl,
    shareUrl: CONFIG.SITE_URL + 'gallery.html?id=' + id,
  });
}

// ───────── 一覧・詳細 ─────────
function _listPosts(p) {
  const limit = Math.max(1, Math.min(parseInt(p.limit || '24', 10) || 24, 50));
  const offset = Math.max(0, parseInt(p.offset || '0', 10) || 0);
  const sort = p.sort === 'popular' ? 'popular' : 'new';

  let items = _approvedItems();
  if (sort === 'popular') items.sort((a, b) => b.likes - a.likes || b.timestamp - a.timestamp);
  else items.sort((a, b) => b.timestamp - a.timestamp);

  return _json({ ok: true, items: items.slice(offset, offset + limit), total: items.length });
}

function _detailPost(p) {
  const id = String(p.id || '');
  if (!id) return _json({ ok: false, error: 'id required' });
  const item = _approvedItems().find(x => x.id === id);
  return item ? _json({ ok: true, item: item }) : _json({ ok: false, error: 'not found' });
}

function _approvedItems() {
  const data = _getSheet(CONFIG.SHEET_NAME).getDataRange().getValues().slice(1);
  return data
    .filter(r => String(r[COL.status - 1]).trim() === 'approved')
    .map(r => ({
      id: String(r[COL.id - 1]),
      timestamp: new Date(r[COL.timestamp - 1]).getTime(),
      name: String(r[COL.name - 1]).replace(/^'/, ''),
      comment: String(r[COL.comment - 1]).replace(/^'/, ''),
      imageUrl: String(r[COL.imageUrl - 1]),
      likes: Number(r[COL.likes - 1]) || 0,
    }));
}

// ───────── いいね ─────────
function _toggleLike(p) {
  const postId = String(p.id || '').slice(0, 64);
  const voterId = String(p.voter || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const op = p.op === 'remove' ? 'remove' : 'add';
  if (!postId || voterId.length < 8) return _json({ ok: false, error: 'params required' });

  const cache = CacheService.getScriptCache();
  const rk = 'like_' + _hash(voterId);
  const n = Number(cache.get(rk) || 0);
  if (n > 30) return _json({ ok: false, error: 'too many requests' });
  cache.put(rk, String(n + 1), 60);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const posts = _getSheet(CONFIG.SHEET_NAME);
    const postData = posts.getDataRange().getValues();
    const idx = postData.findIndex((r, i) => i > 0 && String(r[COL.id - 1]) === postId);
    if (idx < 0 || String(postData[idx][COL.status - 1]).trim() !== 'approved') {
      return _json({ ok: false, error: 'post not found' });
    }

    const likesSheet = _getLikesSheet();
    const likeData = likesSheet.getDataRange().getValues();
    const existing = likeData.findIndex((r, i) => i > 0 && String(r[0]) === postId && String(r[1]) === voterId);

    if (op === 'add' && existing < 0) likesSheet.appendRow([postId, voterId, new Date()]);
    if (op === 'remove' && existing > 0) likesSheet.deleteRow(existing + 1);

    // 実数で再集計（ズレ防止）
    let likes = 0;
    const after = likesSheet.getDataRange().getValues();
    for (let i = 1; i < after.length; i++) if (String(after[i][0]) === postId) likes++;
    posts.getRange(idx + 1, COL.likes).setValue(likes);
    return _json({ ok: true, likes: likes });
  } finally {
    lock.releaseLock();
  }
}

// ───────── ヘルパー ─────────
function _ss() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || CONFIG.DEFAULT_SPREADSHEET_ID;
  return SpreadsheetApp.openById(id);
}

function _getSheet(name) {
  const ss = _ss();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(['id', 'timestamp', 'name', 'comment', 'fileId', 'imageUrl', 'status', 'likes', 'ua']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _getLikesSheet() {
  const ss = _ss();
  let sh = ss.getSheetByName(CONFIG.LIKES_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.LIKES_SHEET_NAME);
    sh.appendRow(['postId', 'voterId', 'timestamp']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _clean(v, max) {
  return String(v || '')
    .replace(/[\u0000-\u001F\u007F​-‏‪-‮]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// スプレッドシートの数式インジェクション防止
function _sheetText(v) {
  return /^[=+@-]/.test(v) ? "'" + v : v;
}

function _isImageBytes(bytes, mime) {
  const b = bytes.slice(0, 4).map(x => (x + 256) % 256);
  if (mime === 'image/png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  return b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
}

function _hash(s) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s));
  return Utilities.base64EncodeWebSafe(d).slice(0, 22);
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ───────── 管理者用（エディタから実行） ─────────

/** シート作成と status 列の承認プルダウンを設定 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID')) props.setProperty('SPREADSHEET_ID', CONFIG.DEFAULT_SPREADSHEET_ID);
  const sh = _getSheet(CONFIG.SHEET_NAME);
  _getLikesSheet();
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS, true).setAllowInvalid(false).build();
  sh.getRange(2, COL.status, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  console.log('OK: ' + _ss().getUrl());
}

/** テスト投稿（smoke test の残骸）を非掲載にする */
function hideTestPosts() {
  const sh = _getSheet(CONFIG.SHEET_NAME);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (/test|テスト|smoke/i.test(String(data[i][COL.name - 1]))) sh.getRange(i + 1, COL.status).setValue('rejected');
  }
}

/** 最新5件をログ出力 */
function debug_listRecent() {
  console.log(_getSheet(CONFIG.SHEET_NAME).getDataRange().getValues().slice(-5));
}

// ───────── 入力文字のチェック（画面側 js/ng-words.js の控え） ─────────
// 画面側は迂回できるので、サーバーでももう一度見る。
var NG_RE = /(しね|死ね|ころす|殺す|殺害|自殺|くたばれ|消えろ|ばか|馬鹿|baka|あほ|阿呆|ぶす|不細工|でぶ|きもい|うざい|きちがい|気違い|基地外|池沼|どじん|土人|ちょん|ざいにち|ぶらく|部落|乞食|めくら|つんぼ|ちんこ|ちんぽ|まんこ|せっくす|性交|猥褻|わいせつ|強姦|ごうかん|れいぷ|痴漢|ちかん|売春|援助交際|ろりこん|えろ|hentai|fuck|fuk|shit|bitch|bastard|asshole|cunt|dick|pussy|penis|vagina|porn|sex|rape|rapist|pedo|whore|slut|nigger|nigga|faggot|retard|idiot|stupid|kys|覚醒剤|大麻|麻薬|爆弾|拳銃|テロ|てろ)/;
var NG_PAT = [/https?:\/\//i, /www\./i, /[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, /[a-z0-9-]+\.(com|net|org|jp|io|me|xyz|shop|info|biz)\b/i, /0\d{1,4}[-ー\s]?\d{1,4}[-ー\s]?\d{3,4}/];

function _hasNg(src) {
  var raw = String(src || '');
  if (!raw) return false;
  for (var i = 0; i < NG_PAT.length; i++) if (NG_PAT[i].test(raw)) return true;
  var s = raw.normalize ? raw.normalize('NFKC') : raw;
  s = s.toLowerCase();
  s = s.replace(/[\u30a1-\u30f6]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  s = s.replace(/[^0-9a-z\u3040-\u309f\u4e00-\u9fff]/g, '');
  s = s.replace(/(.)\1{2,}/g, '$1$1');
  s = s.split('ばかんす').join('').split('しねま').join('').split('ちんすこう').join('').split('class').join('').split('pass').join('');
  return NG_RE.test(s);
}
