/* Optionele pincode. Eén keer invoeren, daarna onthouden in localStorage. */
import { api } from './api.js';
import { el, leeg } from './util.js';

/**
 * Haalt de startgegevens op en vraagt zo nodig eerst om de pincode.
 * @returns {Promise<object>} de startgegevens
 */
export async function zorgVoorToegang() {
  let start = await api.start();
  let melding = '';
  while (start.pinNodig) {
    const code = await vraagPincode(melding);
    api.zetPincode(code);
    start = await api.start();
    melding = '';
    if (start.pinNodig) {
      api.wisPincode();
      melding = 'Die code klopt niet. Probeer het nog eens.';
    }
  }
  return start;
}

let overlay = null;

function vraagPincode(melding = '') {
  return new Promise((klaar) => {
    if (!overlay) {
      overlay = el('div', { class: 'overlay', id: 'pin-overlay' });
      document.body.append(overlay);
    }
    leeg(overlay);
    overlay.hidden = false;

    const invoer = el('input', {
      type: 'password', inputmode: 'numeric', autocomplete: 'off',
      id: 'pin-invoer', placeholder: '••••',
    });
    const fout = el('p', { class: 'hulp', id: 'pin-fout', tekst: melding, stijl: { color: 'var(--fout)' } });

    const versturen = (e) => {
      e.preventDefault();
      const waarde = invoer.value.trim();
      if (!waarde) return;
      overlay.hidden = true;
      klaar(waarde);
    };

    overlay.append(el('form', { class: 'modaal', onsubmit: versturen }, [
      el('div', { class: 'modaal-kop' }, [el('h2', { tekst: 'Toegangscode' })]),
      el('div', { class: 'modaal-lijf' }, [
        el('p', { class: 'stil', tekst: 'Vul de code in die je hebt gekregen. Je hoeft dit maar één keer te doen op dit apparaat.' }),
        el('label', { class: 'veld' }, [el('span', { tekst: 'Code' }), invoer]),
        fout,
      ]),
      el('div', { class: 'modaal-voet' }, [
        el('button', { class: 'knop primair', type: 'submit', tekst: 'Verder' }),
      ]),
    ]));
    setTimeout(() => invoer.focus(), 60);
  });
}
