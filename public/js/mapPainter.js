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
  constructor(geo, size) {
    this.geo = geo;
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.overlay = document.createElement('canvas');
    this.overlay.width = this.overlay.height = Math.min(2048, size / 2);
  }

  paintBase({ style = 'classic', labels = false } = {}) {
    const S = this.size;
    const k = S / 4096;
    const ctx = this.canvas.getContext('2d');
    const proj = makeProjection(S);
    const path = d3.geoPath(proj, ctx);
    const c = S / 2;
    const classic = style !== 'terrain';
    const rAt = (lat) => ((90 - lat) / 180) * c;

    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.clip();

    // Ocean
    const ocean = ctx.createRadialGradient(c, c, 0, c, c, c);
    if (classic) {
      ocean.addColorStop(0, '#6fc3ee');
      ocean.addColorStop(0.5, '#3d97d6');
      ocean.addColorStop(0.85, '#2a77bb');
      ocean.addColorStop(1, '#1f5f9e');
    } else {
      ocean.addColorStop(0, '#3d8fcf');
      ocean.addColorStop(0.5, '#1f64ab');
      ocean.addColorStop(0.85, '#164f8f');
      ocean.addColorStop(1, '#113f74');
    }
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, S, S);
    speckle(ctx, S, 26000 * k * k + 6000, 'rgba(255,255,255,0.05)', 'rgba(0,20,60,0.06)');

    // Shallow-water glow along every coast
    ctx.save();
    ctx.filter = `blur(${Math.max(2, 10 * k)}px)`;
    ctx.beginPath();
    path(this.geo.land);
    ctx.lineWidth = 22 * k;
    ctx.strokeStyle = classic ? 'rgba(200,240,255,0.55)' : 'rgba(120,210,255,0.45)';
    ctx.stroke();
    ctx.restore();

    // Graticule (15°)
    ctx.beginPath();
    path(d3.geoGraticule().step([15, 15]).extentMajor([[-180, -89.999], [180, 89.999]])());
    ctx.lineWidth = 1.4 * k;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();

    // Land
    if (classic) {
      for (const f of this.geo.features) {
        ctx.beginPath();
        path(f);
        ctx.fillStyle = f.properties.isIce ? ICE : POLITICAL[f.properties.colour];
        ctx.fill();
      }
      // gentle relief shading so it reads like a printed card, not flat vector art
      ctx.save();
      ctx.beginPath();
      path(this.geo.land);
      ctx.clip();
      speckle(ctx, S, 60000 * k * k + 8000, 'rgba(255,255,255,0.08)', 'rgba(60,30,0,0.07)');
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      path(this.geo.land);
      ctx.clip();
      const t = ctx.createRadialGradient(c, c, 0, c, c, c);
      [
        [0, '#eef5f7'], [0.1, '#dfe9e4'], [0.14, '#a3b897'], [0.2, '#5e8b4f'], [0.29, '#6f9f50'],
        [0.34, '#b5a85e'], [0.38, '#d9b97a'], [0.42, '#c9ad6a'], [0.46, '#5f9a43'], [0.5, '#3c7b33'],
        [0.56, '#5f9a43'], [0.61, '#c4a96b'], [0.67, '#c9ae6e'], [0.72, '#7ea456'], [0.8, '#8ea98a'],
        [0.85, '#e6eff4'], [1, '#f7fbff'],
      ].forEach(([o, col]) => t.addColorStop(o, col));
      ctx.fillStyle = t;
      ctx.fillRect(0, 0, S, S);
      speckle(ctx, S, 90000 * k * k + 10000, 'rgba(255,255,255,0.10)', 'rgba(30,20,0,0.12)');
      ctx.restore();
    }

    // Borders + coastlines
    ctx.beginPath();
    path(this.geo.borders);
    ctx.lineWidth = (classic ? 1.6 : 1.2) * k;
    ctx.strokeStyle = classic ? 'rgba(60,40,40,0.55)' : 'rgba(40,30,15,0.45)';
    ctx.stroke();
    ctx.beginPath();
    path(this.geo.land);
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = classic ? 'rgba(20,50,90,0.75)' : 'rgba(10,40,70,0.6)';
    ctx.stroke();

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
      ctx.lineWidth = circle.width * k;
      ctx.strokeStyle = circle.colour;
      ctx.shadowColor = circle.colour;
      ctx.shadowBlur = 8 * k;
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
  }

  paintLabels(ctx, proj, k) {
    const path = d3.geoPath(proj);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const f of this.geo.features) {
      if (f.properties.isIce) continue;
      const a = path.area(f);
      if (a < 700 * k * k) continue;
      const size = Math.max(18 * k, Math.min(140 * k, Math.sqrt(a) * 0.15));
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
    const path = d3.geoPath(makeProjection(S), ctx);
    ctx.clearRect(0, 0, S, S);
    for (const it of items) {
      ctx.beginPath();
      if (it.feature) path(it.feature);
      else if (it.circle) path(d3.geoCircle().center(it.circle.center).radius(it.circle.radius)());
      if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(); }
      if (it.stroke) { ctx.lineWidth = (it.width || 6) * k * 2; ctx.strokeStyle = it.stroke; ctx.stroke(); }
    }
  }
}

function speckle(ctx, S, n, light, dark) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i & 1 ? light : dark;
    const s = 1 + Math.random() * (S / 1400);
    ctx.fillRect(Math.random() * S, Math.random() * S, s, s);
  }
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
