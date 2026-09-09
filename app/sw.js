/* Service worker: houdt de app zelf op het toestel, zodat hij ook zonder bereik
   opent. Gegevens gaan hier niet doorheen — die regelt de app zelf, met een
   wachtrij en een momentopname in de browseropslag. */

const VERSIE = 'schoonmaak-ontwikkel';
const SCHIL = [
  './',
  './index.html',
  './beheer.html',
  './schoonmaak.html',
  './css/app.css',
  './icoon.svg',
  './manifest.webmanifest',
  './js/beheer.js',
  './js/bron.js',
  './js/config.js',
  './js/document.js',
  './js/fotos.js',
  './js/fotoscherm.js',
  './js/gist.js',
  './js/melding.js',
  './js/modaal.js',
  './js/opslag.js',
  './js/pwa.js',
  './js/schoonmaak.js',
  './js/seed.js',
  './js/setup.js',
  './js/status.js',
  './js/testbanner.js',
  './js/testdata.js',
  './js/util.js',
  './js/versie.js',
  './js/week.js',
  './js/werktijd.js',
  './versie.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSIE)
      // Eén ontbrekend bestand mag de installatie niet laten mislukken.
      .then((cache) => Promise.all(SCHIL.map((pad) => cache.add(pad).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== VERSIE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

const AFBEELDING = /\.(png|svg|jpe?g|webp|ico)$/i;

self.addEventListener('fetch', (e) => {
  const verzoek = e.request;
  if (verzoek.method !== 'GET') return;

  const url = new URL(verzoek.url);
  // Alles van GitHub gaat rechtstreeks: dat is verse data, geen app-bestand.
  if (url.origin !== self.location.origin) return;

  // Plaatjes veranderen niet meer als ze er eenmaal zijn: die mogen uit de cache.
  if (AFBEELDING.test(url.pathname)) {
    e.respondWith(uitCacheEerst(verzoek));
    return;
  }

  // Pagina's en code: eerst het netwerk. Anders zie je na een publicatie nog
  // de oude app, en dat is precies wat we niet willen. Duurt het te lang of is
  // er geen bereik, dan pakken we alsnog de cache — daar is offline voor.
  e.respondWith(uitNetwerkEerst(verzoek));
});

async function uitCacheEerst(verzoek) {
  const uitCache = await caches.match(verzoek);
  if (uitCache) return uitCache;
  const antwoord = await fetch(verzoek);
  if (antwoord.ok) (await caches.open(VERSIE)).put(verzoek, antwoord.clone());
  return antwoord;
}

async function uitNetwerkEerst(verzoek, wachtMs = 4000) {
  const afbreker = new AbortController();
  const klok = setTimeout(() => afbreker.abort(), wachtMs);
  try {
    const antwoord = await fetch(verzoek, { signal: afbreker.signal });
    if (antwoord.ok) (await caches.open(VERSIE)).put(verzoek, antwoord.clone());
    return antwoord;
  } catch {
    const uitCache = await caches.match(verzoek);
    if (uitCache) return uitCache;
    // Een pagina die we niet hebben: dan maar de startpagina uit de cache.
    if (verzoek.mode === 'navigate') {
      const start = await caches.match('./schoonmaak.html') || await caches.match('./index.html');
      if (start) return start;
    }
    throw new Error('Niet beschikbaar en niet in de cache.');
  } finally {
    clearTimeout(klok);
  }
}
