// Pre-renders the disc map pictures used by Simple mode (public/assets/map-*.webp), so visitors'
// browsers never have to paint the map themselves. Re-run after changing mapPainter.js or the data:
//   npm start   (in another terminal)
//   node scripts/bake-maps.cjs
// Needs Playwright with Chromium installed (npx playwright install chromium).
const { chromium } = require('playwright');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const SIZE = 2048;
const variants = [
  ['map-classic', { style: 'classic', labels: false }],
  ['map-classic-labels', { style: 'classic', labels: true }],
  ['map-terrain', { style: 'terrain', labels: false }],
  ['map-terrain-labels', { style: 'terrain', labels: true }],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${process.env.BASE || 'http://localhost:8080'}/404.html`);
  for (const src of ['vendor/d3-array-3.2.4.min.js', 'vendor/d3-geo-3.1.1.min.js', 'vendor/topojson-client-3.1.0.min.js']) {
    await page.addScriptTag({ url: `/${src}` });
  }
  for (const [name, opts] of variants) {
    const data = await page.evaluate(async ({ opts, SIZE }) => {
      const { Geo } = await import('/js/geo.js');
      const { MapPainter } = await import('/js/mapPainter.js');
      await document.fonts.load('600 32px "Fredoka Variable"');
      window.__geo = window.__geo || await Geo.load('/data/countries-50m.json');
      const p = new MapPainter(window.__geo, SIZE);
      await p.paintBase(opts, async () => {});
      return p.canvas.toDataURL('image/webp', 0.86);
    }, { opts, SIZE });
    const file = join(__dirname, '..', 'public', 'assets', `${name}.webp`);
    writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(name, Math.round(Buffer.byteLength(data, 'base64') * 0.75 / 1024), 'KB');
  }
  await browser.close();
})();
