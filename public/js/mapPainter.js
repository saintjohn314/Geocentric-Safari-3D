// Paints the azimuthal-equidistant disc texture (and a lightweight highlight overlay) with D3 on canvas.
import { makeProjection } from './geo.js';

const { d3 } = window;

const POLITICAL = ['#f6d55c', '#f59b5b', '#9bd06a', '#ef6f8d', '#c4a7ec', '#7fd8c0'];
const ICE = '#eef6fb';

const CIRCLES = [
  { lat: 66.56, label: 'ARCTIC CIRCLE', colour: '#a8ecff', dash: [10, 8], width: 2.2, at: -135 },
  { lat: 23.44, label: 'TROPIC OF CANCER', colour: '#ffb35c', dash: [10, 8], width: 2.4, at: -130 },
  { lat: 0, label: 'EQUATOR', colour: '#ffe066', dash: [18, 8], width: 4, at: -122 },
  { lat: -23.44, label: 'TROPIC OF CAPRICORN', colour: '#ffb35c', dash: [10, 8], width: 2.4, at: -117 },
];

export class MapPainter {
  constructor(geo, size, overlaySize = 1024) {
    this.geo = geo;
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.overlay = document.createElement('canvas');
    this.overlay.width = this.overlay.height = overlaySize;
    this.overlayPaths = new Map();
    this.token = 0;
  }

  // Project every shape once into reusable Path2D objects; repaints (labels, map style) then only fill pixels.
  async buildPaths(pause) {
    if (this.paths) return;
    const proj = makeProjection(this.size);
    const toPath = (obj) => {
      const p = new Path2D();
      d3.geoPath(proj, p)(obj);
      return p;
    };
    const area = d3.geoPath(proj);
    const paths = { proj, land: toPath(this.geo.land) };
    await pause();
    paths.borders = toPath(this.geo.borders);
    paths.graticule = toPath(d3.geoGraticule().step([15, 15]).extentMajor([[-180, -89.999], [180, 89.999]])());
    await pause();
    paths.features = [];
    for (const [i, f] of this.geo.features.entries()) {
      paths.features.push({ f, path: toPath(f), area: area.area(f) });
      if (i % 60 === 59) await pause();
    }
    this.paths = paths;
  }

  // Paints in small steps, yielding to the browser between them so the page never locks up.
  // Returns false if a newer paint request superseded this one.
  async paintBase({ style = 'classic', labels = false } = {}, pause = nextFrame) {
    const token = ++this.token;
    await this.buildPaths(pause);
    if (token !== this.token) return false;
    const { proj, land, borders, graticule, features } = this.paths;
    const S = this.size;
    const k = S / 4096;
    const ctx = this.canvas.getContext('2d');
    const c = S / 2;
    const classic = style !== 'terrain';
    const rAt = (lat) => ((90 - lat) / 180) * c;
    const grain = ctx.createPattern(noiseTile(), 'repeat');

    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.clip();

    // Ocean
    const ocean = ctx.createRadialGradient(c, c, 0, c, c, c);
    (classic
      ? [[0, '#6fc3ee'], [0.5, '#3d97d6'], [0.85, '#2a77bb'], [1, '#1f5f9e']]
      : [[0, '#3d8fcf'], [0.5, '#1f64ab'], [0.85, '#164f8f'], [1, '#113f74']]
    ).forEach(([o, col]) => ocean.addColorStop(o, col));
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, S, S);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, S, S);
    ctx.globalAlpha = 1;

    // Shallow-water glow along every coast: a few soft strokes instead of a costly blur filter
    ctx.lineJoin = 'round';
    for (const [w, a] of [[30, 0.12], [18, 0.2], [9, 0.3]]) {
      ctx.lineWidth = w * k;
      ctx.strokeStyle = classic ? `rgba(200,240,255,${a})` : `rgba(120,210,255,${a * 0.85})`;
      ctx.stroke(land);
    }

    ctx.lineWidth = 1.4 * k;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke(graticule);
    if (!(await this.step(token, pause))) return false;

    // Land
    if (classic) {
      for (const { f, path } of features) {
        ctx.fillStyle = f.properties.isIce ? ICE : POLITICAL[f.properties.colour];
        ctx.fill(path);
      }
    } else {
      const t = ctx.createRadialGradient(c, c, 0, c, c, c);
      [
        [0, '#eef5f7'], [0.1, '#dfe9e4'], [0.14, '#a3b897'], [0.2, '#5e8b4f'], [0.29, '#6f9f50'],
        [0.34, '#b5a85e'], [0.38, '#d9b97a'], [0.42, '#c9ad6a'], [0.46, '#5f9a43'], [0.5, '#3c7b33'],
        [0.56, '#5f9a43'], [0.61, '#c4a96b'], [0.67, '#c9ae6e'], [0.72, '#7ea456'], [0.8, '#8ea98a'],
        [0.85, '#e6eff4'], [1, '#f7fbff'],
      ].forEach(([o, col]) => t.addColorStop(o, col));
      ctx.fillStyle = t;
      ctx.fill(land);
    }
    // printed-card grain on the land
    ctx.save();
    ctx.clip(land);
    ctx.globalAlpha = classic ? 0.7 : 1;
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    if (!(await this.step(token, pause))) return false;

    // Borders + coastlines
    ctx.lineWidth = (classic ? 1.6 : 1.2) * k;
    ctx.strokeStyle = classic ? 'rgba(60,40,40,0.55)' : 'rgba(40,30,15,0.45)';
    ctx.stroke(borders);
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = classic ? 'rgba(20,50,90,0.75)' : 'rgba(10,40,70,0.6)';
    ctx.stroke(land);

    // Ice rim: guarantee a clean frozen edge all the way round
    const ice = ctx.createRadialGradient(c, c, rAt(-74), c, c, c);
    ice.addColorStop(0, 'rgba(238,246,251,0)');
    ice.addColorStop(0.35, 'rgba(238,246,251,0.9)');
    ice.addColorStop(1, '#ffffff');
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.arc(c, c, rAt(-74), 0, Math.PI * 2, true);
    ctx.fillStyle = ice;
    ctx.fill('evenodd');

    // Named circles of latitude, with lettering set along the curve
    for (const circle of CIRCLES) {
      const r = rAt(circle.lat);
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.setLineDash(circle.dash.map((v) => v * k));
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = circle.width * 3 * k;
      ctx.strokeStyle = circle.colour;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = circle.width * k;
      ctx.stroke();
      ctx.restore();
      arcText(ctx, circle.label, c, r + 16 * k, circle.at, 26 * k, circle.colour);
    }

    // Longitude ring on the ice
    ctx.save();
    ctx.font = `600 ${30 * k}px "Fredoka Variable", "Fredoka", sans-serif`;
    ctx.fillStyle = '#25507e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let lon = -150; lon <= 180; lon += 30) {
      const [x, y] = proj([lon, -84.5]);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(y - c, x - c) - Math.PI / 2);
      ctx.fillText(lon === 0 ? '0°' : lon === 180 ? '180°' : `${Math.abs(lon)}°${lon > 0 ? 'E' : 'W'}`, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // Compass star on the North Pole
    compass(ctx, c, c, 46 * k);

    if (labels) this.paintLabels(ctx, proj, k);
    ctx.restore();
    return token === this.token;
  }

  async step(token, pause) {
    if (token !== this.token) {
      this.canvas.getContext('2d').restore();
      return false;
    }
    await pause();
    if (token === this.token) return true;
    this.canvas.getContext('2d').restore();
    return false;
  }

  paintLabels(ctx, proj, k) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const { f, area } of this.paths.features) {
      if (f.properties.isIce || area < 700 * k * k) continue;
      const size = Math.max(18 * k, Math.min(140 * k, Math.sqrt(area) * 0.15));
      const [x, y] = proj(f.properties.labelPoint);
      ctx.font = `600 ${size}px "Fredoka Variable", "Fredoka", sans-serif`;
      ctx.lineWidth = size * 0.28;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.fillStyle = '#1b2433';
      ctx.strokeText(f.properties.name, x, y);
      ctx.fillText(f.properties.name, x, y);
    }
    ctx.restore();
  }

  // items: [{ feature, fill, stroke }] or [{ circle: {center:[lon,lat], radius:deg}, fill, stroke }]
  paintOverlay(items) {
    const S = this.overlay.width;
    const k = S / 4096;
    const ctx = this.overlay.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    for (const it of items) {
      const path = it.feature ? this.overlayPath(it.feature) : this.circlePath(it.circle);
      if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(path); }
      if (it.stroke) { ctx.lineWidth = (it.width || 6) * k * 2; ctx.strokeStyle = it.stroke; ctx.stroke(path); }
    }
  }

  overlayPath(feature) {
    let p = this.overlayPaths.get(feature);
    if (!p) {
      p = new Path2D();
      d3.geoPath(makeProjection(this.overlay.width), p)(feature);
      this.overlayPaths.set(feature, p);
    }
    return p;
  }

  circlePath(circle) {
    const p = new Path2D();
    d3.geoPath(makeProjection(this.overlay.width), p)(d3.geoCircle().center(circle.center).radius(circle.radius).precision(2)());
    return p;
  }
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

let tile = null;
function noiseTile() {
  if (tile) return tile;
  tile = document.createElement('canvas');
  tile.width = tile.height = 256;
  const g = tile.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const r = Math.random();
    const light = r > 0.5;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 30;
    img.data[i + 3] = r > 0.93 || r < 0.07 ? 22 : 0;
  }
  g.putImageData(img, 0, 0);
  return tile;
}

function arcText(ctx, text, c, r, startDeg, size, colour) {
  ctx.save();
  ctx.font = `700 ${size}px "Fredoka Variable", "Fredoka", sans-serif`;
  ctx.fillStyle = colour;
  ctx.strokeStyle = 'rgba(10,30,60,0.55)';
  ctx.lineWidth = size * 0.22;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let a = (startDeg * Math.PI) / 180;
  for (const ch of text) {
    const w = ctx.measureText(ch).width + size * 0.08;
    const da = w / r;
    a += da / 2;
    ctx.save();
    ctx.translate(c + r * Math.cos(a), c + r * Math.sin(a));
    ctx.rotate(a + Math.PI / 2);
    ctx.strokeText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += da / 2;
  }
  ctx.restore();
}

function compass(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0;
    const len = long ? r : r * 0.55;
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(r * 0.14, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = long ? '#ffd23f' : '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(-r * 0.14, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = long ? '#c98f00' : '#9fb4c8';
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = '#ff3b5c';
  ctx.fill();
  ctx.restore();
}
