// Copies the third-party runtime files the site needs from node_modules into
// public/vendor so the deployed site has no CDN dependencies (works offline as a PWA).
// Bare `three` imports inside three's addons are rewritten to relative paths so
// no import map is required (keeps a strict Content-Security-Policy possible).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, relative, posix } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(new URL(import.meta.url).pathname), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'vendor');
const ver = (pkg) => require(join(nm, pkg, 'package.json')).version;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
};

// ---- three.js core + the addons we use (and their transitive deps) ----
const threeDir = join(out, `three-${ver('three')}`);
copy(join(nm, 'three/build/three.module.min.js'), join(threeDir, 'three.module.min.js'));
copy(join(nm, 'three/build/three.core.min.js'), join(threeDir, 'three.core.min.js'));
copy(join(nm, 'three/LICENSE'), join(threeDir, 'LICENSE'));

const addonsSrc = join(nm, 'three/examples/jsm');
const entryAddons = [
  'controls/OrbitControls.js',
  'environments/RoomEnvironment.js',
];
const seen = new Set();
const queue = [...entryAddons];
while (queue.length) {
  const rel = queue.shift();
  if (seen.has(rel)) continue;
  seen.add(rel);
  let src = readFileSync(join(addonsSrc, rel), 'utf8');
  const depth = rel.split('/').length; // addons/<dir>/<file> -> up to threeDir
  const toCore = posix.join(...Array(depth).fill('..'), 'three.module.min.js');
  for (const m of src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    queue.push(posix.normalize(posix.join(posix.dirname(rel), m[1])));
  }
  src = src.replace(/from\s+['"]three['"]/g, `from '${toCore}'`);
  const dest = join(threeDir, 'addons', rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, src);
}

// ---- d3 (UMD globals) + topojson ----
copy(join(nm, 'd3-array/dist/d3-array.min.js'), join(out, `d3-array-${ver('d3-array')}.min.js`));
copy(join(nm, 'd3-geo/dist/d3-geo.min.js'), join(out, `d3-geo-${ver('d3-geo')}.min.js`));
copy(join(nm, 'topojson-client/dist/topojson-client.min.js'), join(out, `topojson-client-${ver('topojson-client')}.min.js`));

// ---- map data (Natural Earth via world-atlas) ----
const dataDir = join(root, 'public', 'data');
mkdirSync(dataDir, { recursive: true });
copy(join(nm, 'world-atlas/countries-50m.json'), join(dataDir, 'countries-50m.json'));

// ---- fonts (latin subsets only) ----
const fonts = join(out, 'fonts');
copy(join(nm, '@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2'), join(fonts, 'fredoka-latin-wght.woff2'));
copy(join(nm, '@fontsource/vt323/files/vt323-latin-400-normal.woff2'), join(fonts, 'vt323-latin-400.woff2'));
copy(join(nm, '@fontsource/share-tech-mono/files/share-tech-mono-latin-400-normal.woff2'), join(fonts, 'share-tech-mono-latin-400.woff2'));

writeFileSync(join(out, 'README.txt'), [
  'Third-party files copied by scripts/vendor.mjs - do not edit by hand.',
  `three.js ${ver('three')} (MIT)`,
  `d3-array ${ver('d3-array')}, d3-geo ${ver('d3-geo')} (ISC)`,
  `topojson-client ${ver('topojson-client')} (ISC)`,
  `world-atlas ${ver('world-atlas')} (ISC) - Natural Earth data (public domain)`,
  'Fredoka, VT323, Share Tech Mono fonts (SIL Open Font License) via Fontsource',
  '',
].join('\n'));

console.log('vendored:', [...seen].map((s) => 'three/addons/' + s).join(', '));
console.log('three dir:', relative(root, threeDir));
if (!existsSync(join(dataDir, 'countries-50m.json'))) process.exit(1);
