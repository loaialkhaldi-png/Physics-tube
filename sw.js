// يحفظ ملفات التطبيق على الجهاز ليفتح بسرعة ويعمل بدون إنترنت
const CACHE = 'physics-tube-v126';
const SHELL = ['./', 'index.html', 'quiz-bank.js', 'games.js', 'classroom.js', 'bank-g10.js', 'bank-g11.js', 'bank-g12.js', 'qbank.js', 'teacher.js', 'visitors.js', 'leaders.js', 'achieve.js', 'prep.js', 'laws.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];

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
  // The app page and its scripts: open straight from the device (no waiting for the internet, even on a weak signal),
  // and fetch the newest copy quietly for next time. A new version (new CACHE number) installs in the background
  // and the page reloads once by itself (see index.html), so updates still arrive within seconds.
  const home = new URL('./', location).pathname, page = url.pathname === home || url.pathname === home + 'index.html';
  const key = page ? './' : req;
  const done = caches.open(CACHE).then(cache => cache.match(key, page ? { ignoreSearch: true } : undefined).then(hit => {
    // The app page itself is always checked with the server (GitHub may hand out a 10-minute-old copy otherwise).
    const refresh = fetch(req, page ? { cache: 'no-cache' } : undefined).then(r => {
      if (r.ok && !r.redirected) return cache.put(key, r.clone()).then(() => r);
      return r;
    });
    if (hit) return { hit, refresh: refresh.catch(() => {}) };
    return { hit: refresh.catch(() => caches.match(req).then(r => r || caches.match('index.html'))) };  // offline, not saved yet
  }));
  e.respondWith(done.then(x => x.hit));
  e.waitUntil(done.then(x => x.refresh));
});
