/* Eén statusbalkje onderin voor "opgeslagen" / "opslaan mislukt". */
import { el, leeg } from './util.js';

let balk = null;
let verbergTimer = null;

function zorgVoorBalk() {
  if (!balk) {
    balk = el('div', { class: 'statusrand', role: 'status', 'aria-live': 'polite' });
    document.body.append(balk);
  }
  return balk;
}

/**
 * @param {string} tekst
 * @param {'goed'|'bezig'|'fout'} soort
 * @param {{duur?: number, actie?: {tekst: string, bij: Function}}} opties
 */
export function meld(tekst, soort = 'goed', opties = {}) {
  const knoop = zorgVoorBalk();
  clearTimeout(verbergTimer);
  leeg(knoop);
  knoop.className = `statusrand zichtbaar ${soort === 'fout' ? 'fout' : soort === 'bezig' ? 'bezig' : ''}`;
  if (soort === 'bezig') knoop.append(el('span', { class: 'draaier' }));
  knoop.append(el('span', { tekst }));
  if (opties.actie) {
    knoop.append(el('button', { class: 'knop', tekst: opties.actie.tekst, onclick: opties.actie.bij }));
  }
  const duur = opties.duur ?? (soort === 'goed' ? 1800 : soort === 'fout' ? 0 : 0);
  if (duur > 0) verbergTimer = setTimeout(verbergMelding, duur);
}

export function verbergMelding() {
  clearTimeout(verbergTimer);
  if (balk) balk.classList.remove('zichtbaar');
}
