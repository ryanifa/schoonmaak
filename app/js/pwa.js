/* Registreert de service worker, zodat de app op de telefoon op het beginscherm
   kan en ook zonder bereik opent. */

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Zonder service worker werkt de app gewoon, alleen niet offline.
    });
  });
}
