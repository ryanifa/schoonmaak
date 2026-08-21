/* Eén venster-component voor beide weergaven. */
import { el } from './util.js';

export function toonModaal({ titel, ondertitel, inhoud, knoppen }) {
  const overlay = el('div', { class: 'overlay' });
  const sluit = () => {
    overlay.remove();
    document.removeEventListener('keydown', bijToets);
  };
  const bijToets = (e) => { if (e.key === 'Escape') sluit(); };
  document.addEventListener('keydown', bijToets);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) sluit(); });

  overlay.append(el('div', { class: 'modaal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titel }, [
    el('div', { class: 'modaal-kop' }, [
      el('h2', { tekst: titel }),
      el('button', { class: 'sluit', type: 'button', 'aria-label': 'Sluiten', tekst: '×', onclick: sluit }),
    ]),
    el('div', { class: 'modaal-lijf' }, [
      ondertitel ? el('p', { class: 'stil klein', tekst: ondertitel }) : null,
      ...inhoud.filter(Boolean),
    ]),
    el('div', { class: 'modaal-voet' }, knoppen.map((k) => el('button', {
      class: `knop${k.primair ? ' primair' : ''}`, type: 'button', tekst: k.tekst, onclick: k.bij,
    }))),
  ]));
  document.body.append(overlay);
  return { sluit, overlay };
}
