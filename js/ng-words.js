// ============================================================
// 入力文字のチェック（刻印・ニックネーム・コメント共通）
//
// 公式サイトに出る文字なので、以下を弾きます。
//   ・誹謗中傷、差別、性的、暴力的な言葉
//   ・URL、メールアドレス、電話番号などの連絡先（勧誘・晒し対策）
//
// 表記ゆらし（全角半角・カタカナひらがな・記号はさみ・leet）を
// つぶしてから照合するので、「し ね」「ｼﾈ」「s h i n e」も引っかかります。
// 誤検知しやすい短い語は、先に ALLOW の語を取り除いてから見ます。
// ============================================================

const NGWords = (function () {
  // ───────── 先に取り除く、ふつうの言葉 ─────────
  // 「ばかんす」のように、NGワードを部分的に含んでしまう普通の言葉。
  const ALLOW = [
    'ばかんす', 'ばかり', 'ばかげ', 'ばかぼん', 'あいつぁばか',
    'しねま', 'しねましか', 'おいしいね', 'たのしいね', 'うれしいね', 'さびしいね', 'かなしいね',
    'あほうどり', 'ちんすこう', 'ちんあなご', 'ちんたら', 'ちんれつ', 'ちんもく',
    'まんごー', 'まんてん', 'まんなか', 'まんげつ', 'まんねん', 'まんがん',
    'しかく', 'しかい', 'きんし', 'かすみ', 'かすてら', 'かすたーど',
    'ごみばこ', 'ぐみ', 'くずもち', 'くずきり',
    'assistant', 'class', 'classic', 'grass', 'pass', 'password', 'bass', 'glass', 'brass',
    'analysis', 'canal', 'scunthorpe', 'cockpit', 'cocktail', 'peacock', 'shiitake',
    'document', 'assess', 'massachusetts', 'assemble', 'assign', 'embassy', 'compass',
  ];

  // ───────── 弾く言葉 ─────────
  const WORDS = [
    // 暴力・自傷をあおる言葉
    'しね', 'しねよ', 'ころす', 'ころしたい', 'ぶっころ', 'じさつしろ', 'じさつしよう',
    'しんどけ', 'しんでくれ', 'しんでしまえ', 'くたばれ', 'たひね',
    'killyourself', 'killyou', 'kys', 'diealready',
    // 侮辱
    'ばか', 'あほ', 'まぬけ', 'のろま', 'ぶす', 'ぶさいく', 'でぶ', 'ちび', 'はげ',
    'きもい', 'きしょい', 'きもちわるい', 'うざい', 'うぜー', 'くず', 'ごみくず', 'かす',
    'むのう', 'むのうすぎ', 'いきてるかち', 'いらない', 'きえろ', 'でていけ',
    'idiot', 'stupid', 'moron', 'dumbass', 'loser', 'ugly', 'retard', 'retarded',
    'fuck', 'fucking', 'fuk', 'shit', 'bullshit', 'bitch', 'bastard', 'asshole',
    'wtf', 'stfu', 'damnyou', 'scum', 'trash',
    // 差別語
    'きちがい', 'きちがいじみ', 'ちしょう', 'めくら', 'つんぼ', 'おし', 'かたわ',
    'どじん', 'ちょん', 'しなじん', 'ざいにち', 'ぶらく', 'えた', 'ひにん', 'こじき',
    'nigger', 'nigga', 'chink', 'jap', 'gook', 'spic', 'faggot', 'fag', 'tranny', 'dyke',
    // 性的
    'せっくす', 'せくろす', 'ちんこ', 'ちんぽ', 'ちんちん', 'まんこ', 'おまんこ',
    'ぺにす', 'ばぎな', 'おっぱい', 'きょにゅう', 'ひんにゅう', 'せいこうい',
    'ふぇら', 'くんに', 'おなに', 'しこる', 'いんらん', 'ちかん', 'ろりこん', 'しょたこん',
    'えろ', 'えろい', 'えっち', 'ひわい', 'ぬーど', 'はだか', 'らいぶちゃっと',
    'れいぷ', 'ごうかん', 'わいせつ', 'ふうぞく', 'えんこう', 'ぱぱかつ', 'うりせん',
    'sex', 'sexy', 'porn', 'porno', 'hentai', 'nude', 'naked', 'boobs', 'tits',
    'dick', 'cock', 'pussy', 'cunt', 'vagina', 'penis', 'anal', 'blowjob', 'handjob',
    'cum', 'horny', 'milf', 'rape', 'rapist', 'pedo', 'pedophile', 'loli', 'whore', 'slut', 'hooker',
    // 犯罪・薬物・危険物
    'かくせいざい', 'しゃぶきめ', 'たいま', 'まりふぁな', 'こかいん', 'へろいん',
    'だつほうほう', 'みせいねんいんりょう',
    'ばくだん', 'ばくはつぶつ', 'じゅう', 'ぴすとる', 'てろ', 'てろよこく', 'ころしよこく',
    'meth', 'cocaine', 'heroin', 'weed', 'marijuana', 'bomb', 'terror', 'terrorist',
    // 漢字表記（正規化してもひらがなにはならないので別に持つ）
    '死ね', '死んで', '死ねよ', '殺す', '殺し', '殺害', '自殺しろ', '首吊', '消えろ', '出て行け',
    '馬鹿', '阿呆', '間抜', '不細工', '醜い', '無能', '屑野郎', '糞', '基地外', '気違い', '池沼',
    '土人', '乞食', '部落民', '穢多', '非人', '障害者差別',
    '性交', '猥褻', '強姦', '痴漢', '売春', '援助交際', '風俗嬢', '童貞', '処女厨', '変態',
    '覚醒剤', '大麻', '麻薬', '爆弾', '拳銃', '殺害予告', '爆破予告',
    // ローマ字表記（ＢＡＫＡ のような打ち方への備え。英単語と紛れるものは入れない）
    'baka', 'ahou', 'busu', 'kimoi', 'uzai', 'korosu', 'korosuzo', 'shinjae',
    'chinko', 'chinpo', 'manko', 'omanko', 'sekkusu', 'ero', 'erogaki', 'hentai',
    // 勧誘・スパム
    'もうかる', 'もうけばなし', 'ふくぎょう', 'かんたんにかせ', 'にっきゅう',
    'とうしかんゆう', 'みえるかせぐ', 'さぽーとします',
    'casino', 'viagra', 'cialis', 'bitcoinprofit', 'freemoney', 'clickhere', 'subscribeto',
  ];

  // ───────── 弾くかたち ─────────
  const PATTERNS = [
    [/https?:\/\//i, 'リンク'],
    [/\bwww\./i, 'リンク'],
    [/[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}/i, 'メールアドレス'],
    [/[a-z0-9-]+\.(?:com|net|org|jp|co\.jp|io|me|xyz|shop|info|biz)\b/i, 'リンク'],
    [/0\d{1,4}[-ー－\s]?\d{1,4}[-ー－\s]?\d{3,4}/, '電話番号'],
    [/\b(?:line|ライン|らいん)\s*(?:id|アイディー|あいでぃー)\b/i, '連絡先'],
    [/@[a-z0-9_]{3,}/i, 'アカウント名'],
  ];

  // ───────── 正規化 ─────────
  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

  function normalize(src) {
    let s = String(src || '');
    try { s = s.normalize('NFKC'); } catch (e) { /* 古い環境では素通り */ }
    s = s.toLowerCase();
    // カタカナ → ひらがな（長音・小書きも寄せる）
    s = s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
    s = s.replace(/[ゃゅょぁぃぅぇぉっ]/g, (c) => 'やゆよあいうえおつ'['ゃゅょぁぃぅぇぉっ'.indexOf(c)]);
    s = s.replace(/[ー－—‐\-~〜]/g, '');
    // leet を戻す
    s = s.replace(/[01345 7@$!]/g, (c) => LEET[c] || '');
    // 文字と数字以外（記号・空白・絵文字）は落とす
    s = s.replace(/[^0-9a-z぀-ゟ一-鿿]/g, '');
    // 3文字以上の繰り返しは2文字にそろえる（しねええ → しねえ）
    s = s.replace(/(.)\1{2,}/g, '$1$1');
    return s;
  }

  // ───────── 判定 ─────────
  function check(src) {
    const raw = String(src || '');
    if (!raw.trim()) return { ok: true };

    // 全角で打たれた URL や ＬＩＮＥ ID も拾えるよう、幅だけそろえた形でも見る
    let soft = raw;
    try { soft = raw.normalize('NFKC'); } catch (e) { /* 古い環境では素通り */ }
    soft = soft.toLowerCase();

    for (const [re, label] of PATTERNS) {
      if (re.test(raw) || re.test(soft)) return { ok: false, reason: `${label}は入力できません` };
    }

    let s = normalize(raw);
    for (const a of ALLOW) s = s.split(a).join('');   // ふつうの言葉を先に抜く

    for (const w of WORDS) {
      if (s.includes(w)) return { ok: false, reason: '使えない言葉が含まれています' };
    }
    return { ok: true };
  }

  return { check, normalize };
})();

if (typeof window !== 'undefined') window.NGWords = NGWords;
