// ============================================================
// スタート画面に流れる「みんなのスノードーム」の帯
//  ・ギャラリーに追加された作品を新しい順に流します
//  ・まだ少ないときは、見本の作品で埋めます（「見本」と表示）
// ============================================================

const STREAM_SAMPLES = [
  { img: 'assets/samples/s01.webp', name: 'ピラミッドの夜' },
  { img: 'assets/samples/s02.webp', name: 'Stille Nacht' },
  { img: 'assets/samples/s03.webp', name: 'Winterliebe' },
  { img: 'assets/samples/s04.webp', name: 'Goldener Markt' },
  { img: 'assets/samples/s05.webp', name: 'Sternennacht' },
  { img: 'assets/samples/s06.webp', name: 'ぼたん雪' },
  { img: 'assets/samples/s07.webp', name: 'Markt Party' },
  { img: 'assets/samples/s08.webp', name: 'Silberne Stadt' },
  { img: 'assets/samples/s09.webp', name: 'しんしんと' },
  { img: 'assets/samples/s10.webp', name: 'Polarlicht' },
];

(function initGlobeStream() {
  const sec = document.getElementById('globeStream');
  const track = document.getElementById('streamTrack');
  if (!sec || !track) return;

  const want = (typeof CONFIG !== 'undefined' && CONFIG.STREAM_COUNT) || 10;

  function card(item) {
    const el = document.createElement(item.id ? 'a' : 'div');
    el.className = 'stream-card' + (item.sample ? ' is-sample' : '');
    if (item.id) { el.href = 'gallery.html?id=' + encodeURIComponent(item.id); }
    el.innerHTML = `<span class="sc-thumb"><img src="${item.img}" alt="" loading="lazy" draggable="false"></span>
      <span class="sc-name">${esc(item.name || '')}</span>
      ${item.sample ? '<span class="sc-badge">見本</span>' : ''}`;
    return el;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(items) {
    track.innerHTML = '';
    if (!items.length) { sec.remove(); return; }
    // 切れ目なく流すため、同じ並びを2回置く
    for (let pass = 0; pass < 2; pass++) {
      items.forEach((it) => {
        const el = card(it);
        if (pass === 1) el.setAttribute('aria-hidden', 'true');
        track.appendChild(el);
      });
    }
    // 1枚あたり約4.5秒で流れる速さ
    track.style.setProperty('--stream-duration', (items.length * 4.5) + 's');
    sec.classList.add('ready');
  }

  const samples = STREAM_SAMPLES.map((s) => ({ ...s, sample: true }));

  // まずは見本で表示しておき、投稿があれば差し替える
  render(samples.slice(0, want));

  const url = typeof CONFIG !== 'undefined' && CONFIG.GAS_WEBAPP_URL;
  if (!url) return;
  fetch(`${url}?action=list&sort=new&limit=${want}`)
    .then((r) => r.json())
    .then((d) => {
      if (!d || !d.ok || !d.items || !d.items.length) return;
      const posts = d.items.map((it) => ({ img: it.imageUrl, name: it.name, id: it.id }));
      // 足りない分は見本で埋める
      render(posts.concat(samples).slice(0, want));
    })
    .catch(() => {});
})();
