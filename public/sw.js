// HyperVolley service worker — oyunu internetsiz de açılabilir yapar.
// Strateji: sayfa (HTML) için önce ağ, yoksa önbellek; diğer dosyalar için önce önbellek.
// Yeni sürüm yayınlayınca VERSION'ı değiştirin (eski önbellek silinir).
const VERSION = 'hv-v28';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['./', './manifest.webmanifest', './icons/icon-192.png'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  if (req.mode === 'navigate') {
    // HTML: güncel sürümü almaya çalış, internet yoksa önbellekten aç
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./', copy)); return res; })
        .catch(() => caches.match('./')),
    );
    return;
  }

  // JS/CSS/ikon/yazı tipi: önbellekte varsa oradan, yoksa indirip sakla
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
