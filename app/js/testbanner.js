/* Zichtbare herinnering dat je in de testmodus zit. */
import { el } from './util.js';

export function toonTestbalkIndienNodig(toegang) {
  if (!toegang?.test) return;
  document.body.prepend(el('div', { class: 'testbalk' }, [
    el('span', { tekst: '🧪 Testmodus — alles blijft in deze browser.' }),
    el('a', { href: './index.html', tekst: 'inrichten' }),
  ]));
}
