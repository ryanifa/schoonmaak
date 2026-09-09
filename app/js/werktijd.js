/* Bewaakt lopende bezoeken: sluit ze af als er niet op "klaar" is getikt, en
   houdt bij welke herinnering al getoond is.

   Er is geen server, dus dit gebeurt zodra een apparaat de app opent. Ook als
   haar telefoon uit staat sluit de laptop van de beheerder het bezoek dus af. */

import { autoStopBewerkingen } from './document.js';

/**
 * Sluit bezoeken die over hun tijd heen zijn. Geeft terug hoeveel er afgesloten
 * zijn, zodat de weergave er iets over kan zeggen.
 */
export function sluitVergetenBezoeken(opslag) {
  const bewerkingen = autoStopBewerkingen(opslag.document());
  for (const bewerking of bewerkingen) {
    opslag.doe(bewerking, { vervangSleutel: `autostop:${bewerking.id}` });
  }
  return bewerkingen.length;
}

/* Welke herinnering is op dit toestel al weggeklikt? Dat is bewust per toestel:
   het zegt iets over wat zij gezien heeft, niet over de gegevens zelf. */

const sleutelVoor = (bezoekId) => `schoonmaak.herinnerd.${bezoekId}`;

export function alGezien(bezoekId) {
  try {
    return Number(localStorage.getItem(sleutelVoor(bezoekId))) || 0;
  } catch {
    return 0;
  }
}

export function onthoudGezien(bezoekId, nummer) {
  try {
    localStorage.setItem(sleutelVoor(bezoekId), String(nummer));
  } catch { /* privémodus: dan alleen deze sessie */ }
}
