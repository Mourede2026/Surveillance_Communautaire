// Service worker minimal : rend l'application "installable" (PWA) et permet de rouvrir
// l'interface même sans connexion. Les appels à l'API (Google Apps Script, autre origine,
// toujours en POST) ne sont jamais interceptés ici — ils continuent normalement, en échouant
// simplement si l'appareil est hors-ligne (l'app affiche déjà ses propres messages d'erreur).
//
// CACHE_VERSION : incrémenter à chaque mise à jour des fichiers listés ci-dessous, sinon les
// téléphones qui ont déjà installé l'app continueront de voir une ancienne version en cache.
const CACHE_VERSION = 'surveillance-v1';

const APP_SHELL = [
  './',
  './index.html',
  './rc.html',
  './ascq.html',
  './pf.html',
  './rcse.html',
  './national.html',
  './manifest.json',
  './assets/style.css',
  './assets/briefing.css',
  './assets/api.js',
  './assets/geo-utils.js',
  './assets/geo-benin-data.js',
  './assets/rapport.js',
  './assets/forms.js',
  './assets/bulk-import.js',
  './assets/user-admin.js',
  './assets/briefing.js',
  './assets/briefing-data.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ne jamais intercepter : les requêtes non-GET (tous les appels API sont en POST) et tout ce
  // qui n'est pas servi par ce même site (l'API Google Apps Script est sur une autre origine).
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
