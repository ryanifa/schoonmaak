/* Service worker: houdt de app zelf op het toestel, zodat hij ook zonder bereik
   opent. Gegevens gaan hier niet doorheen — die regelt de app zelf, met een
   wachtrij en een momentopname in de browseropslag. */

const VERSIE = 'schoonmaak-v2';
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
  './js/week.js',
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

self.addEventListener('fetch', (e) => {
  const verzoek = e.request;
  if (verzoek.method !== 'GET') return;

  const url = new URL(verzoek.url);
  // Alles van GitHub gaat rechtstreeks: dat is verse data, geen app-bestand.
  if (url.origin !== self.location.origin) return;

  // Meteen uit de cache serveren, en op de achtergrond bijwerken voor de
  // volgende keer. Zo opent de app direct, ook op een trage verbinding.
  e.respondWith(
    caches.match(verzoek).then((uitCache) => {
      const uitNetwerk = fetch(verzoek)
        .then((antwoord) => {
          if (antwoord.ok) {
            const kopie = antwoord.clone();
            caches.open(VERSIE).then((cache) => cache.put(verzoek, kopie));
          }
          return antwoord;
        })
        .catch(() => uitCache);
      return uitCache || uitNetwerk;
    }),
  );
});
