/* Foto schermvullend bekijken. */
import { el, leeg, voegToe } from './util.js';

let scherm = null;

export function toonFoto(url, bijschrift = '') {
  if (!scherm) {
    scherm = el('div', { class: 'fotoscherm', hidden: true, onclick: sluitFoto });
    document.body.append(scherm);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') sluitFoto(); });
  }
  voegToe(
    leeg(scherm),
    el('img', { src: url, alt: bijschrift || 'Voorbeeldfoto' }),
    bijschrift ? el('div', { class: 'bijschrift', tekst: bijschrift }) : null,
  );
  scherm.hidden = false;
}

export function sluitFoto() {
  if (scherm) scherm.hidden = true;
}
