// يحفظ ملفات التطبيق على الجهاز ليفتح بسرعة ويعمل بدون إنترنت
const CACHE = 'physics-tube-v56';
const SHELL = ['./', 'index.html', 'quiz-bank.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first so content updates show immediately; fall back to cache offline.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    // Pages may serve a cached copy for up to 10 minutes; always revalidate the app page itself.
    fetch(e.request, e.request.mode === 'navigate' || /index\.html$|\/$/.test(url.pathname) ? { cache: 'no-cache' } : undefined).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
