// Service Worker: immer zuerst beim Server nachfragen (Updates kommen sofort an),
// offline die zuletzt geladene Version liefern. Hörbuch-Spuren (mp3) nicht abfangen:
// Browser laden sie in Teilen (Range-Anfragen), das soll direkt der Server beantworten.
const CACHE = 'stories-v6';
const ASSETS = ['./', './index.html', './read.html', './books.js', './manifest.webmanifest',
  './assets/style.css', './assets/common.js', './assets/library.js', './assets/reader.js',
  './assets/favicon.svg', './assets/icon-192.png', './assets/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/\.(mp3|m4a)$/.test(url.pathname) || req.headers.has('range')) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: url.pathname.endsWith('read.html') })
        .then((hit) => hit || caches.match('./index.html')))
  );
});
