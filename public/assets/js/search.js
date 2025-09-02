(() => {
  const params = new URLSearchParams(location.search);
  const q = (params.get('q') || '').trim();
  const out = document.getElementById('results');
  if (!out) return;
  const esc = (s) => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const render = (items) => {
    if (!q) { out.innerHTML = '<p>キーワードを入力してください。</p>'; return; }
    if (!items || items.length === 0) { out.innerHTML = `<p>「${esc(q)}」に一致するページは見つかりませんでした。</p>`; return; }
    out.innerHTML = `<p>${items.length}件ヒット</p>` +
      '<ul>' + items.slice(0, 200).map(u => `<li><a href="${esc(u)}">${esc(u)}</a></li>`).join('') + '</ul>';
  };
  if (!q) return render([]);
  const sitemaps = ['/sitemap-moth.xml','/sitemap-butterfly.xml','/sitemap-leafbeetle.xml','/sitemap-plant.xml'];
  const fetchText = (u) => fetch(u, {cache:'no-store'}).then(r => r.ok ? r.text(): '');
  Promise.all(sitemaps.map(fetchText)).then(xmls => {
    const urls = [];
    xmls.forEach(x => {
      (x.match(/<loc>[^<]+<\/loc>/g) || []).forEach(loc => {
        const m = loc.match(/<loc>([^<]+)<\/loc>/);
        if (m) urls.push(m[1]);
      });
    });
    const decoded = urls.map(u => ({ raw: u, dec: decodeURIComponent(u) }));
    const ql = q.toLowerCase();
    const hits = decoded.filter(o => o.dec.toLowerCase().includes(ql)).map(o => o.raw);
    render(hits);
  }).catch(() => render([]));
})();

