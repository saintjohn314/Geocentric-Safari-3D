import { App } from './app.js';

const app = new App();
window.geocentricSafari = app; // handy for debugging from the console
app.start();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
