# Geocentric Safari 3D

**The electronic geography quiz — on the disc.** A tribute to the classic 90's GeoSafari quiz console, played on a 3D azimuthal-equidistant (flat earth model) map under a glass firmament dome.

Live: https://geocentric-safari-3d.netlify.app

![Geocentric Safari 3D](public/assets/og-image.jpg)

## What's in the box

- **Lesson cards, GeoSafari style.** 7 cards × 20 numbered spots: Nations of the Disc, Capital Cities, Wonders & Landmarks, Peaks & Volcanoes, Oceans/Seas & Lakes, Islands & Territories, Explorer's Extremes. Every spot has a clue and a "did you know?" fact.
- **The console.** 20 question lamps around the board, red seven-segment score displays, an amber countdown timer, a green entry readout and a chunky rubber keypad. Answer by typing the spot number and pressing **GO**, or tap the spot.
- **Three tries, beat the clock.** First-try answers score 100, then 60, then 30, plus 5 points per second left and a streak bonus. After a miss the right spot flashes so everyone learns it.
- **Two-player mode.** Players alternate, each with their own score display and turn light.
- **Map Hunt mode.** No numbers — tap the place itself. Misses tell you how far off you were and which way to head.
- **A living sky.** The sun, moon (with its real phase) and constellations hang over the places where they are overhead *right now*, computed from a low-precision ephemeris. Daylight sweeps across the disc; speed the sky clock up in Settings.
- **The model.** North Pole at the centre, the prime meridian pointing down (the UN-emblem layout), the Antarctic ice rim as a wall of ice shards, a gold base ring with chasing lights, and the glass firmament dome over it all.
- **Free Explore.** Hover or tap anywhere to identify countries with their coordinates, local solar time and sun altitude.
- **Polish.** Synthesised console sounds, optional talking console (reads questions aloud), country-name labels, classic-card or terrain map styles, bloom lighting on capable devices, a battery-saver mode, keyboard shortcuts, high scores per card, and it installs as an offline-capable app (PWA).

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Orbit / zoom / pan | Drag · scroll or pinch · right-drag | |
| Turn the disc | ⟲ ⟳ buttons | `A` / `D` |
| Top-down card view / 3D view | TOP / 3D | `T` / `V` |
| Enter a spot number | Keypad | `0`–`9`, `Enter` = GO, `Backspace` = CLR |
| Hint (half points) | HINT | `H` |
| Country names | 🏷️ | `L` |
| Pause / menu | MENU | `Esc` |

## Project layout

```
public/            ← the whole site (Netlify publishes this folder)
  index.html
  css/style.css
  js/              ← app.js (game), world.js (Three.js scene), mapPainter.js (D3 map texture),
                     spots.js (numbered spots), cards.js (lesson cards), astro.js (sun/moon/stars),
                     geo.js (map data + disc maths), sevenseg.js, audio.js, main.js
  data/            ← Natural Earth countries (world-atlas 50m)
  vendor/          ← three.js, d3-geo, topojson, fonts — copied from npm, no CDN needed
  sw.js            ← generated offline service worker
scripts/           ← vendor.mjs, precache.mjs, serve.mjs
netlify.toml       ← publish dir, security headers (CSP), caching
```

## Develop

```bash
npm install
npm run build   # copy vendor files + regenerate sw.js
npm start       # http://localhost:8080
```

Run `npm run build` after changing anything in `public/` so the service worker picks up the new files.

## Deploy to Netlify

The Netlify project **geocentric-safari-3d** is already set up. Pick one:

- **Connect the repo (auto-deploys on every push):** Netlify → *geocentric-safari-3d* → Project configuration → Build & deploy → Link repository → choose this GitHub repo and the branch to publish. `netlify.toml` already sets the publish folder (`public`) and no build command.
- **One-off deploy from your machine:**
  ```bash
  npx netlify-cli deploy --prod --dir=public --site=geocentric-safari-3d
  ```

## Credits

Map data © [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas). Built with [three.js](https://threejs.org/), [d3-geo](https://github.com/d3/d3-geo) and [topojson](https://github.com/topojson/topojson-client). Fonts: Fredoka, VT323, Share Tech Mono (SIL OFL). GeoSafari is a trademark of Educational Insights; this is an unaffiliated fan tribute by JW Games.
