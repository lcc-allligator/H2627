// Offline cache for the app files. Your logged data is NOT stored here
// (it lives in the browser's localStorage), so changing this file never touches it.
const CACHE = 'habits-v5';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png'
];
const TIMEOUT_MS = 3500; // slow ship Wi-Fi: fall back to the cached copy instead of hanging

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('habits-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates arrive), cached copy when offline or slow.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate';

  const fromCache = () => caches.match(req, { ignoreSearch: isPage })
    .then(r => r || (isPage ? caches.match('./index.html') : undefined));

  const fromNetwork = fetch(req).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(isPage ? './index.html' : req, copy));
    }
    return res;
  });

  e.respondWith(new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => fromCache().then(finish), TIMEOUT_MS);
    fromNetwork
      .then(res => { clearTimeout(timer); if (res.ok || done) finish(res); else fromCache().then(r => finish(r || res)); })
      .catch(() => { clearTimeout(timer); fromCache().then(r => finish(r || Response.error())); });
  }));
});
