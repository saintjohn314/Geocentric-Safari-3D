// Country data, naming, colouring and the disc mapping.
// The disc is an azimuthal-equidistant map centred on the North Pole (like the UN emblem):
// distance from the centre is proportional to colatitude, the prime meridian points "down" (+z).
const { d3, topojson } = window;

export const DISC_R = 10; // world units

const NAME_FIXES = {
  'United States of America': 'United States',
  'Dem. Rep. Congo': 'DR Congo',
  'Central African Rep.': 'Central African Republic',
  'Dominican Rep.': 'Dominican Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  'S. Sudan': 'South Sudan',
  'W. Sahara': 'Western Sahara',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Antigua and Barb.': 'Antigua and Barbuda',
  'Faeroe Is.': 'Faroe Islands',
  'N. Mariana Is.': 'Northern Mariana Islands',
  'Wallis and Futuna Is.': 'Wallis and Futuna',
  'Heard I. and McDonald Is.': 'Heard and McDonald Islands',
  'Fr. Polynesia': 'French Polynesia',
  'Fr. S. Antarctic Lands': 'French Southern Lands',
  'Br. Indian Ocean Ter.': 'British Indian Ocean Territory',
  'Indian Ocean Ter.': 'Australian Indian Ocean Territories',
  'S. Geo. and the Is.': 'South Georgia and the South Sandwich Islands',
  'St. Vin. and Gren.': 'Saint Vincent and the Grenadines',
  'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'St. Pierre and Miquelon': 'Saint Pierre and Miquelon',
  'St-Barthélemy': 'Saint Barthélemy',
  'St-Martin': 'Saint Martin',
  'N. Cyprus': 'Northern Cyprus',
  Macedonia: 'North Macedonia',
  eSwatini: 'Eswatini',
  Vatican: 'Vatican City',
  Antarctica: 'Antarctica (Ice Rim)',
};

const cleanName = (n) => NAME_FIXES[n] || n.replace(/ Is\.$/, ' Islands');

// lon/lat (degrees) -> disc-local x/z (world units). Exact for azimuthal equidistant.
export function lonLatToLocal(lon, lat, R = DISC_R) {
  const r = ((90 - lat) / 180) * R;
  const l = (lon * Math.PI) / 180;
  return { x: r * Math.sin(l), z: r * Math.cos(l), r };
}

export function localToLonLat(x, z, R = DISC_R) {
  const r = Math.hypot(x, z);
  const lat = 90 - (180 * r) / R;
  const lon = r < 1e-9 ? 0 : (Math.atan2(x, z) * 180) / Math.PI;
  return [lon, lat];
}

// UV on the disc texture (u right, v up) <-> lon/lat
export const lonLatToUV = (lon, lat) => {
  const p = lonLatToLocal(lon, lat, 1);
  return [(p.x + 1) / 2, (-p.z + 1) / 2];
};
export const uvToLonLat = (u, v) => localToLonLat(u * 2 - 1, -(v * 2 - 1), 1);

export const distanceKm = (a, b) => d3.geoDistance(a, b) * 6371;

export function makeProjection(size) {
  return d3.geoAzimuthalEquidistant()
    .rotate([0, -90])
    .scale(size / 2 / Math.PI)
    .translate([size / 2, size / 2])
    .clipAngle(180 - 1e-3)
    .precision(0); // Natural Earth 50m is already dense; skipping adaptive resampling is much faster
}

export class Geo {
  static async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Map data failed to load (${res.status})`);
    return new Geo(await res.json());
  }

  constructor(topology) {
    const obj = topology.objects.countries;
    this.features = topojson.feature(topology, obj).features;
    this.land = topojson.merge(topology, obj.geometries);
    this.borders = topojson.mesh(topology, obj, (a, b) => a !== b);
    this.byName = new Map();

    const neighbors = topojson.neighbors(obj.geometries);
    this.features.forEach((f, i) => {
      f.properties.name = cleanName(f.properties.name);
      f.properties.index = i;
      f.properties.isIce = f.properties.name.startsWith('Antarctica');
      f.properties.area = d3.geoArea(f);
      f.properties.bounds = d3.geoBounds(f);
      f.properties.labelPoint = largestPolygonCentroid(f);
      this.byName.set(f.properties.name, f);
    });

    // Greedy map colouring so neighbouring countries never share a colour (classic school-map look).
    const order = this.features.map((_, i) => i).sort((a, b) => neighbors[b].length - neighbors[a].length);
    const colours = new Array(this.features.length).fill(-1);
    const N = 6;
    for (const i of order) {
      const used = new Set(neighbors[i].map((j) => colours[j]));
      const h = hash(this.features[i].properties.name);
      for (let k = 0; k < N; k++) {
        const c = (h + k) % N;
        if (!used.has(c)) { colours[i] = c; break; }
      }
      if (colours[i] < 0) colours[i] = h % N;
      this.features[i].properties.colour = colours[i];
    }
  }

  feature(name) {
    return this.byName.get(name) || null;
  }

  countryAt(lonlat) {
    const [lon, lat] = lonlat;
    let best = null;
    for (const f of this.features) {
      const [[w, s], [e, n]] = f.properties.bounds;
      if (lat < s - 0.01 || lat > n + 0.01) continue;
      const inLon = w <= e ? lon >= w - 0.01 && lon <= e + 0.01 : lon >= w - 0.01 || lon <= e + 0.01;
      if (!inLon) continue;
      // Prefer the smallest containing feature (enclaves such as Lesotho, Vatican City).
      if (d3.geoContains(f, lonlat) && (!best || f.properties.area < best.properties.area)) best = f;
    }
    return best;
  }
}

function largestPolygonCentroid(f) {
  const g = f.geometry;
  if (!g) return [0, 0];
  if (g.type === 'Polygon') return d3.geoCentroid(f);
  let best = null;
  let bestArea = -1;
  for (const coords of g.coordinates) {
    const poly = { type: 'Polygon', coordinates: coords };
    const a = d3.geoArea(poly);
    if (a > bestArea) { bestArea = a; best = poly; }
  }
  return d3.geoCentroid(best);
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
