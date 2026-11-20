// Generates PNG icons and the social share image from SVG. Needs: npm i sharp (dev only).
const fs = require('fs'), path = require('path');
const sharp = require('sharp');
const img = path.join(__dirname, '..', 'public', 'assets', 'img');
const icon = fs.readFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'));
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5d4939"/><stop offset=".62" stop-color="#806750"/><stop offset="1" stop-color="#8f7660"/></linearGradient>
<radialGradient id="sun" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#e6d3ae"/><stop offset=".55" stop-color="#c3a77e"/><stop offset="1" stop-color="#a68b65"/></radialGradient>
</defs>
<rect width="1200" height="630" fill="url(#g)"/>
<circle cx="1040" cy="120" r="190" fill="url(#sun)"/>
<circle cx="80" cy="600" r="140" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="40"/>
<rect x="0" y="0" width="1200" height="14" fill="#292521"/>
<text x="80" y="170" font-family="DejaVu Sans, Arial, sans-serif" font-size="58" font-weight="800" fill="#ffffff">MyNetPay <tspan fill="#c3a77e">ZW</tspan></text>
<text x="80" y="370" font-family="DejaVu Sans, Arial, sans-serif" font-size="72" font-weight="800" fill="#ffffff">Know what actually</text>
<text x="80" y="460" font-family="DejaVu Sans, Arial, sans-serif" font-size="72" font-weight="800" fill="#efdcb6">reaches your pocket</text>
<text x="80" y="540" font-family="DejaVu Sans, Arial, sans-serif" font-size="32" fill="#f4eee3">Zimbabwe salary, PAYE and NSSA calculators \u00b7 USD and ZiG</text>
</svg>`;
(async () => {
  for (const [n, s] of [['icon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]])
    await sharp(icon, { density: 600 }).resize(s, s).png().toFile(path.join(img, n));
  await sharp(Buffer.from(og)).png().toFile(path.join(img, 'og-image.png'));
  console.log('icons written');
})();
