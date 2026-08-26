/* Registreert de service worker, zodat de app op de telefoon op het beginscherm
   kan en ook zonder bereik opent. Meldt het ook als er een nieuwe versie
   klaarstaat — anders zie je na een publicatie nog de oude app. */

import { el } from './util.js';

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', async () => {
    let registratie;
    try {
      registratie = await navigator.serviceWorker.register('./sw.js');
    } catch {
      return; // Zonder service worker werkt de app gewoon, alleen niet offline.
    }

    // Kwam er een nieuwe worker binnen terwijl deze pagina al draaide?
    registratie.addEventListener('updatefound', () => {
      const nieuwe = registratie.installing;
      if (!nieuwe) return;
      nieuwe.addEventListener('statechange', () => {
        // Alleen melden als er al een versie draaide; bij de eerste keer niet.
        if (nieuwe.state === 'installed' && navigator.serviceWorker.controller) toonVernieuwbalk();
      });
    });

    // Bij het openen even kijken of er iets nieuws is.
    registratie.update().catch(() => {});
  });
}

let balk = null;

function toonVernieuwbalk() {
  if (balk) return;
  balk = el('div', { class: 'vernieuwbalk', role: 'status' }, [
    el('span', { tekst: 'Er staat een nieuwe versie klaar.' }),
    el('button', { class: 'knop', type: 'button', tekst: 'Vernieuwen', onclick: () => location.reload() }),
  ]);
  document.body.append(balk);
}
