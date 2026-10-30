import { App } from './app.js';

const app = new App();
window.geocentricSafari = app; // handy for debugging from the console
app.start();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // When a new release's service worker takes over a page that an older one served, reload once
  // so the visitor isn't left running the previous version's cached code.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) {
      reloaded = true;
      location.reload();
    }
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
