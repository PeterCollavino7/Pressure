/* Service worker: serve l'app dalla cache (funziona senza rete) e la aggiorna in sottofondo.
   Gestisce solo file dello stesso sito: nessuna richiesta verso altri indirizzi. I dati delle misure
   non passano di qui (stanno in IndexedDB sul dispositivo). */
const CACHE = 'pressione-d2019ad559c6';
const CORE = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(CORE.map(url =>
        fetch(new Request(url, { cache: 'reload' })).then(res => {
          if (!res.ok) throw new Error(url + ' ' + res.status);
          return cache.put(url, res);
        }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.indexOf('pressione-') === 0 && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* cache prima, aggiornamento in sottofondo */
function staleWhileRevalidate(cacheKey) {
  return caches.open(CACHE).then(cache => cache.match(cacheKey).then(hit => {
    const net = fetch(new Request(cacheKey, { cache: 'no-cache' })).then(res => {
      if (res && res.ok) cache.put(cacheKey, res.clone());
      return res;
    }).catch(() => null);
    if (hit) return hit;
    return net.then(res => res || new Response('Sei offline e l’app non è ancora stata salvata sul dispositivo.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
  }));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate('./index.html'));
    return;
  }
  const rel = './' + url.pathname.split('/').pop();
  if (CORE.indexOf(rel) >= 0) event.respondWith(staleWhileRevalidate(rel));
});
