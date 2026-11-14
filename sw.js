// Network first, so updates arrive; falls back to the saved copy when offline.
const C = 'bellaspeller-v18';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'episodes.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'fonts/atkinson-400.woff2', 'fonts/atkinson-700.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(C).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
