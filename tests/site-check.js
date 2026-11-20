// node tests/site-check.js  - verifies the built site in /public is complete and consistent for Netlify.
const fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, '..', 'public');
let fails = 0;
const bad = (m) => { fails++; console.error('FAIL ' + m); };
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(PUB).map((f) => path.relative(PUB, f).split(path.sep).join('/'));

['index.html', '404.html', 'robots.txt', 'sitemap.xml', 'favicon.svg', 'site.webmanifest', 'assets/css/styles.css', 'assets/js/config.js', 'assets/js/engine.js', 'assets/js/ui.js', 'assets/img/og-image.png', 'assets/img/icon-192.png', 'assets/img/icon-512.png', 'assets/img/apple-touch-icon.png'].forEach((f) => files.includes(f) || bad('missing ' + f));
['netlify.toml', '.gitignore', 'README.md'].forEach((f) => fs.existsSync(path.join(PUB, '..', f)) || bad('missing project file ' + f));

const resolve = (u) => { u = u.split('#')[0].split('?')[0]; if (!u) return true; if (u.endsWith('/')) u += 'index.html'; u = u.replace(/^\//, ''); return files.includes(u) || files.includes(u + '/index.html'); };
const html = files.filter((f) => f.endsWith('.html'));
const titles = new Map(), descs = new Map();
html.forEach((f) => {
  const s = fs.readFileSync(path.join(PUB, f), 'utf8');
  const t = (s.match(/<title>(.*?)<\/title>/) || [])[1], d = (s.match(/<meta name="description" content="(.*?)"/) || [])[1];
  if (!t) bad(f + ': no title'); else { if (titles.has(t)) bad(f + ': duplicate title with ' + titles.get(t)); titles.set(t, f); }
  if (f !== '404.html') { if (!d) bad(f + ': no description'); else { if (descs.has(d)) bad(f + ': duplicate description'); descs.set(d, f); } if (!/<link rel="canonical" href="https:\/\/mynetpay\.co\.zw\//.test(s)) bad(f + ': canonical missing'); }
  if ((s.match(/<h1[ >]/g) || []).length !== 1) bad(f + ': needs exactly one h1');
  if (/nynetpayzw/i.test(s)) bad(f + ': contains forbidden netlify domain text');
  if (/netlify\.app/i.test(s)) bad(f + ': hard-codes a netlify.app address');
  (s.match(/<script type="application\/ld\+json">(.*?)<\/script>/g) || []).forEach((j) => { try { JSON.parse(j.replace(/<\/?script[^>]*>/g, '')); } catch (e) { bad(f + ': bad JSON-LD'); } });
  (s.match(/(?:href|src)="([^"]+)"/g) || []).forEach((a) => {
    const u = a.replace(/^(?:href|src)="/, '').replace(/"$/, '');
    if (/^(https?:|mailto:|tel:|#|data:)/.test(u)) return;
    if (!u.startsWith('/')) return bad(f + ': relative link ' + u);
    if (!resolve(u)) bad(f + ': broken link ' + u);
  });
  const ids = (s.match(/ id="([^"]+)"/g) || []).map((x) => x); if (new Set(ids).size !== ids.length) bad(f + ': duplicate ids');
});
// --- content requirements added after review ---
const read = (f) => fs.readFileSync(path.join(PUB, f), 'utf8');
html.forEach((f) => { const s = read(f); if (/Jan-Dec 2025|2025 (USD|ZWG)|had not published separate|latest official ones/.test(s)) bad(f + ': still describes the figures as 2025 tables'); });
const tt = read('tax-tables/index.html');
/PAYE tables for 1 January to 31 December 2026/.test(tt) || bad('tax-tables page does not reference the 2026 tables');
const bt = read('bonus-tax-calculator/index.html');
['Finance Act (No. 2) of 2024', 'PAYE Explained', 'US$400', 'US$700'].forEach((x) => bt.includes(x) || bad('bonus page missing: ' + x));
const ec = read('employer-cost-calculator/index.html');
/name="sdl"(?![^>]*checked)/.test(ec) || bad('employer SDL checkbox must exist and be unticked by default');
/specified by the Minister of Industry and Commerce/.test(ec) && /specified classes of employers/.test(ec) || bad('employer page must say the SDL applies to specified classes of employers');
/Confirm (with the Ministry of Industry and Commerce )?whether (your business|you) (is|are) liable/i.test(ec) || bad('employer page must tell employers to confirm liability');
/name="zimdef" checked/.test(ec) || bad('ZIMDEF default changed unexpectedly');
const ab = read('about/index.html');
['Finance Act (No. 2) of 2024', 'Chapter 14:19', '2026'].forEach((x) => ab.includes(x) || bad('about page missing: ' + x));
const cfgSrc = fs.readFileSync(path.join(PUB, 'assets/js/config.js'), 'utf8');
/ZIMRA PAYE tables for 1 January to 31 December 2026/.test(cfgSrc) || bad('config.js does not reference the 2026 tables');
/Finance Act \(No\. 2\) of 2024/.test(cfgSrc) || bad('config.js does not cite Finance Act No. 2 of 2024');
const rd = fs.readFileSync(path.join(PUB, '..', 'README.md'), 'utf8');
/2026 tables|2026 PAYE tables/.test(rd) && !/\*\*2025\*\* tables as the latest/.test(rd) || bad('README still describes 2025 tables as the basis');

// --- colour consistency: the taupe/brown palette is the only palette ---
const OLD_PALETTE = ['0b2a21','35544a','5e7a70','0a7a55','064e3b','12a36a','e1f6ea','c8eedb','ffc933','f0a900','fff3c9','f0603a','ffe6dc','1f7fb8','dff0fa','7d5ae0','f3fbf6','d3e8dd','0f9a68','ffd65c','ffe27a','bfe9d4','d3f5e4','e9fff3','f5e19a','a53a18','fbfffd','f7fcf9','fff8f5','b9d4c8'];
const oldRe = new RegExp('#(' + OLD_PALETTE.join('|') + ')\\b|rgba\\(\\s*(18, 163, 106|255, 201, 51|6, 78, 59)', 'i');
['assets/css/styles.css', 'site.webmanifest', 'favicon.svg'].forEach((f) => oldRe.test(read(f)) && bad(f + ': contains a colour from the old green/yellow palette'));
html.forEach((f) => { const t = read(f); if (oldRe.test(t)) bad(f + ': contains a colour from the old green/yellow palette'); });
const root = (read('assets/css/styles.css').match(/:root\s*\{([^}]*)\}/) || [])[1] || '';
const inkHex = (root.match(/--ink:\s*(#[0-9a-fA-F]{6})/) || [])[1];
html.forEach((f) => { const m = read(f).match(/<meta name="theme-color" content="(#[0-9a-fA-F]{6})"/); if (!m) bad(f + ': no theme-color'); else if (inkHex && m[1].toLowerCase() !== inkHex.toLowerCase()) bad(f + ': theme-color ' + m[1] + ' does not match the header colour ' + inkHex); });
const man = JSON.parse(read('site.webmanifest'));
(inkHex && man.theme_color.toLowerCase() === inkHex.toLowerCase()) || bad('manifest theme_color does not match the header colour');
/^#[0-9a-fA-F]{6}$/.test(man.background_color) || bad('manifest background_color invalid');
const heroRule = (read('assets/css/styles.css').match(/\.hero \{[^}]*\}/) || [''])[0];
/#[0-9a-fA-F]{6}/.test(heroRule.replace(/var\([^)]*\)/g, '')) && (heroRule.match(/#[0-9a-fA-F]{6}/g) || []).forEach((h) => { const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (g > r) bad('hero gradient colour ' + h + ' is greenish (green above red); the hero must stay warm taupe/brown'); });
/\.hero h1 em \{[^}]*color:\s*#efdcb6/.test(read('assets/css/styles.css')) || bad('hero headline highlight colour changed (readability fix)');
/<svg viewBox="0 0 56 56"/.test(read('index.html')) && bad('old header logo has come back');

const sm = fs.readFileSync(path.join(PUB, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
locs.forEach((l) => resolve(l.replace('https://mynetpay.co.zw', '')) || bad('sitemap URL has no page: ' + l));
html.filter((f) => f !== '404.html').forEach((f) => { const u = 'https://mynetpay.co.zw/' + f.replace(/index\.html$/, ''); locs.includes(u) || bad('page missing from sitemap: ' + u); });
const toml = fs.readFileSync(path.join(PUB, '..', 'netlify.toml'), 'utf8');
/publish\s*=\s*"public"/.test(toml) || bad('netlify.toml publish dir is not "public"');
console.log(html.length + ' HTML pages, ' + locs.length + ' sitemap URLs checked, ' + files.length + ' files. ' + (fails ? fails + ' PROBLEMS' : 'All checks passed.'));
process.exitCode = fails ? 1 : 0;
