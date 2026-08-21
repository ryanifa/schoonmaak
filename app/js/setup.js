/* Inrichten: sleutel invoeren, Gists aanmaken en de twee links opleveren. */

import { controleerSleutel, maakGist, haalGist, GistFout } from './gist.js';
import { documentNaarBestanden } from './opslag.js';
import { maakVoorbeeldDocument, AANTAL_VOORBEELDTAKEN } from './seed.js';
import { maakLink, bewaarToegang, haalToegang, vergeetToegang } from './config.js';
import { el, leeg, $, voegToe } from './util.js';
import { meld } from './melding.js';

const scherm = () => $('#scherm');
let toegang = null;

function begin() {
  const bestaand = haalToegang('beheerder');
  if (bestaand?.sleutel && bestaand?.dataGist) {
    toegang = bestaand;
    toonKlaar({ alBekend: true });
  } else {
    toonStap1();
  }
}

/* ------------------------------------------------------------------- stap 1 */

function toonStap1(fout = '') {
  const sleutelVeld = el('input', {
    type: 'password', id: 'sleutel', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'github_pat_… of ghp_…',
  });

  const versturen = async (e) => {
    e.preventDefault();
    const sleutel = sleutelVeld.value.trim();
    if (!sleutel) return;
    const knop = $('#verder');
    knop.disabled = true;
    knop.textContent = 'Controleren…';
    try {
      await controleerSleutel(sleutel);
      toonStap2(sleutel);
    } catch (fout) {
      toonStap1(fout instanceof GistFout ? fout.message : 'Kon de sleutel niet controleren.');
      $('#sleutel').value = sleutel;
    }
  };

  voegToe(leeg(scherm()), el('form', { class: 'kaart', onsubmit: versturen }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Stap 1 — je sleutel' })]),
    el('div', { class: 'kaart-binnen' }, [
      el('p', { tekst: 'Deze app bewaart alles in twee Gists op jouw GitHub-account. Daarvoor is één sleutel nodig; die blijft op dit apparaat en komt nergens anders terecht.' }),
      el('div', { class: 'notitie' }, [
        el('div', { class: 'label', tekst: 'Sleutel maken' }),
        el('p', {}, [
          'Ga naar ',
          el('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener', tekst: 'GitHub → fine-grained token' }),
          ', zet bij ',
          el('strong', { tekst: 'Account permissions → Gists' }),
          ' de waarde op ',
          el('strong', { tekst: 'Read and write' }),
          '. Verder heeft de app niets nodig — laat de rest uit staan.',
        ]),
      ]),
      el('label', { class: 'veld' }, [el('span', { tekst: 'Sleutel' }), sleutelVeld]),
      fout ? el('p', { class: 'hulp', stijl: { color: 'var(--fout)' }, tekst: fout }) : null,
      el('button', { class: 'knop primair vol', id: 'verder', type: 'submit', tekst: 'Verder' }),
    ]),
  ]));
  setTimeout(() => sleutelVeld.focus(), 60);
}

/* ------------------------------------------------------------------- stap 2 */

function toonStap2(sleutel) {
  const dataVeld = el('input', { type: 'text', placeholder: 'id van de bestaande gegevens-Gist' });
  const fotoVeld = el('input', { type: 'text', placeholder: 'id van de bestaande foto-Gist' });

  voegToe(leeg(scherm()),
    el('div', { class: 'kaart' }, [
      el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Stap 2 — nieuw beginnen' })]),
      el('div', { class: 'kaart-binnen' }, [
        el('p', { tekst: `De app maakt twee geheime Gists aan en vult de takenbibliotheek met ${AANTAL_VOORBEELDTAKEN} voorbeeldtaken voor een rijtjeshuis. Daarna schaaf je die bij.` }),
        el('button', { class: 'knop primair vol', id: 'maak', tekst: '✨ Gists aanmaken en beginnen', onclick: () => maakAlles(sleutel) }),
      ]),
    ]),
    el('div', { class: 'kaart' }, [
      el('div', { class: 'kaart-kop' }, [el('h3', { tekst: 'Of: bestaande Gists gebruiken' })]),
      el('div', { class: 'kaart-binnen' }, [
        el('p', { class: 'hulp', tekst: 'Heb je de app eerder ingericht, vul dan de twee Gist-ids in. Die vind je in de adresbalk van de Gist op GitHub.' }),
        el('label', { class: 'veld' }, [el('span', { tekst: 'Gegevens-Gist' }), dataVeld]),
        el('label', { class: 'veld' }, [el('span', { tekst: 'Foto-Gist' }), fotoVeld]),
        el('button', {
          class: 'knop vol', tekst: 'Koppelen',
          onclick: () => koppelBestaand(sleutel, dataVeld.value.trim(), fotoVeld.value.trim()),
        }),
      ]),
    ]),
  );
}

async function maakAlles(sleutel) {
  const knop = $('#maak');
  knop.disabled = true;
  knop.textContent = 'Bezig…';
  try {
    const doc = maakVoorbeeldDocument();
    const data = await maakGist(sleutel, {
      beschrijving: 'Schoonmaak — takenbibliotheek, weeklijsten en berichten',
      bestanden: documentNaarBestanden(doc),
    });
    const fotos = await maakGist(sleutel, {
      beschrijving: 'Schoonmaak — voorbeeldfoto\'s bij de taken',
      bestanden: { 'leesmij.txt': 'Foto\'s bij de schoonmaaktaken. Beheerd door de app.' },
    });
    toegang = {
      sleutel, dataGist: data.id, fotoGist: fotos.id,
      gebruiker: data.gebruiker, rol: 'beheerder',
    };
    bewaarToegang(toegang);
    toonKlaar({});
  } catch (fout) {
    knop.disabled = false;
    knop.textContent = '✨ Gists aanmaken en beginnen';
    meld(fout instanceof GistFout ? fout.message : 'Aanmaken mislukt.', 'fout', { duur: 6000 });
  }
}

async function koppelBestaand(sleutel, dataGist, fotoGist) {
  if (!dataGist) return meld('Vul het id van de gegevens-Gist in.', 'fout', { duur: 4000 });
  try {
    const antwoord = await haalGist(sleutel, dataGist);
    toegang = {
      sleutel, dataGist, fotoGist: fotoGist || null,
      gebruiker: antwoord.gebruiker, rol: 'beheerder',
    };
    bewaarToegang(toegang);
    toonKlaar({});
  } catch (fout) {
    meld(fout instanceof GistFout ? fout.message : 'Koppelen mislukt.', 'fout', { duur: 6000 });
  }
}

/* -------------------------------------------------------------------- klaar */

function toonKlaar({ alBekend }) {
  const beheerLink = maakLink(location.href, 'beheerder', toegang);
  const hulpLink = maakLink(location.href, 'schoonmaakster', toegang);

  voegToe(leeg(scherm()),
    alBekend ? null : el('div', { class: 'klaar-melding' }, [
      el('div', { class: 'groot', tekst: '✨' }),
      el('h2', { tekst: 'Alles staat klaar' }),
      el('p', { tekst: 'Hieronder staan je twee links.' }),
    ]),

    linkKaart({
      titel: 'Voor jou — beheer',
      uitleg: 'Takenbibliotheek, weeklijst samenstellen, historie en berichten.',
      link: beheerLink,
      knopTekst: 'Beheer openen',
    }),

    linkKaart({
      titel: 'Voor de schoonmaakster',
      uitleg: 'Stuur deze link naar haar telefoon. Ze tikt hem één keer aan; daarna kan ze hem op haar beginscherm zetten en werkt hij als een app, ook zonder bereik.',
      link: hulpLink,
      knopTekst: 'Bekijken zoals zij het ziet',
    }),

    el('div', { class: 'kaart' }, [
      el('div', { class: 'kaart-kop' }, [el('h3', { tekst: 'Waar je op moet letten' })]),
      el('div', { class: 'kaart-binnen' }, [
        el('p', { tekst: 'In beide links zit je sleutel verwerkt — anders kan haar telefoon niets opslaan. Wie zo\'n link heeft, kan bij de Gists van dit account. Deel ze dus alleen met haar, en gebruik een sleutel die alleen Gists mag.' }),
        el('p', { class: 'hulp', tekst: 'Lekt een link? Trek de sleutel in bij GitHub, maak een nieuwe en richt deze pagina opnieuw in. De Gists blijven gewoon bestaan; koppel ze via "bestaande Gists gebruiken".' }),
        el('div', { class: 'knoppenrij' }, [
          el('button', {
            class: 'knop klein gevaar', tekst: 'Sleutel van dit apparaat wissen',
            onclick: () => { vergeetToegang(); location.reload(); },
          }),
        ]),
      ]),
    ]),
  );
}

function linkKaart({ titel, uitleg, link, knopTekst }) {
  const veld = el('input', { type: 'text', readonly: true, value: link, onclick: (e) => e.target.select() });
  return el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: titel })]),
    el('div', { class: 'kaart-binnen' }, [
      el('p', { class: 'hulp', tekst: uitleg }),
      veld,
      el('div', { class: 'knoppenrij', stijl: { marginTop: '10px' } }, [
        el('button', {
          class: 'knop primair', tekst: '📋 Link kopiëren',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(link);
              meld('Link gekopieerd', 'goed');
            } catch {
              veld.select();
              meld('Kopieer de geselecteerde link met Ctrl+C', 'fout', { duur: 4000 });
            }
          },
        }),
        navigator.share ? el('button', {
          class: 'knop', tekst: '↗ Delen',
          onclick: () => navigator.share({ title: 'Schoonmaak', url: link }).catch(() => {}),
        }) : null,
        el('a', { class: 'knop', href: link, tekst: knopTekst }),
      ]),
    ]),
  ]);
}

begin();
