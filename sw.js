// يحفظ ملفات التطبيق على الجهاز ليفتح بسرعة ويعمل بدون إنترنت
const CACHE = 'physics-tube-v114';
const SHELL = ['./', 'index.html', 'quiz-bank.js', 'games.js', 'classroom.js', 'bank-g10.js', 'bank-g11.js', 'bank-g12.js', 'qbank.js', 'teacher.js', 'leaders.js', 'achieve.js', 'prep.js', 'laws.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  // 'reload' makes sure the freshly installed copy never comes from the browser's old HTTP cache.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Things that rarely change (pictures, drawings, fonts, the Supabase library): show the saved copy at once, refresh it quietly in the background.
const FAST = /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|pdf)$/i;
const FAST_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

function staleWhileRevalidate(req) {
  if (req.headers.has('range')) return fetch(req); // partial downloads (video/PDF) are never stored
  return caches.open(CACHE).then(cache => cache.match(req).then(hit => {
    const refresh = fetch(req).then(r => {
      if (r && (r.status === 200 || r.type === 'opaque')) cache.put(req, r.clone());
      return r;
    }).catch(() => hit);
    return hit || refresh;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;

  if (!same) {
    if (FAST_HOSTS.includes(url.hostname)) e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (FAST.test(url.pathname) || /\/vendor\//.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  // Pages and scripts: network first so content updates show immediately; fall back to cache offline.
  e.respondWith(
    // Pages may serve a cached copy for up to 10 minutes; always revalidate the app page itself.
    fetch(req, req.mode === 'navigate' || /index\.html$|\/$/.test(url.pathname) ? { cache: 'no-cache' } : undefined).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
