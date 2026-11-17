// Always checks the server for a fresh copy (so updates arrive promptly); falls back to the saved copy when offline.
const C = 'bellaspeller-v113';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'episodes.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'fonts/atkinson-400.woff2', 'fonts/atkinson-700.woff2'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => Promise.all(FILES.map(f =>
    fetch(new Request(f, { cache: 'reload' })).then(r => { if (r.ok) return c.put(f, r); }).catch(() => { })
  ))));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  if (new URL(e.request.url).searchParams.has('chk')) return; // version checks go straight to the server and are not saved
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
