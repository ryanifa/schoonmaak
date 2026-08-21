/* Koppelt de opslag aan het statusbalkje onderin: opgeslagen, nog niet
   opgeslagen, of iets dat de gebruiker echt moet weten. */

import { meld } from './melding.js';

export function volgOpslag(opslag) {
  opslag.addEventListener('opgeslagen', () => meld('Opgeslagen', 'goed'));

  opslag.addEventListener('status', (e) => {
    const { openstaand, bezig, fout } = e.detail;
    // Niets meer open? Dan laten we de melding met rust: 'opgeslagen' heeft net
    // de bevestiging getoond, en die verdwijnt vanzelf.
    if (!openstaand) return;
    if (bezig) return meld('Opslaan…', 'bezig');
    if (fout?.tijdelijk) {
      meld(
        openstaand === 1 ? 'Nog niet opgeslagen' : `${openstaand} wijzigingen nog niet opgeslagen`,
        'fout',
        { actie: { tekst: 'Opnieuw', bij: () => opslag.verstuur({ handmatig: true }) } },
      );
    }
  });

  opslag.addEventListener('geblokkeerd', (e) => {
    meld(e.detail.fout.message, 'fout', {
      actie: { tekst: 'Opnieuw', bij: () => opslag.verstuur({ handmatig: true }) },
    });
  });

  // Zodra het netwerk terug is of het scherm weer in beeld komt, meteen proberen.
  window.addEventListener('online', () => opslag.verstuur());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') opslag.verstuur();
  });
  window.addEventListener('beforeunload', (e) => {
    if (opslag.wachtrij.length) { e.preventDefault(); e.returnValue = ''; }
  });
}
