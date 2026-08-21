/* Beheerdersweergave: bibliotheek, week samenstellen, historie en berichten. */
import { api, wachtrij } from './api.js';
import { zorgVoorToegang } from './pin.js';
import { toonFoto } from './fotoscherm.js';
import { meld } from './melding.js';
import {
  el, leeg, voegToe, $, $$, langeDatum, korteDatum, tijdstempel,
  wekenGeledenTekst, meervoud, vinkIcoon, verkleinAfbeelding,
} from './util.js';

const staat = {
  start: null,
  tab: 'week',
  week: { jaar: null, weeknummer: null },
  samensteller: null,
  bibliotheek: null,
  historie: null,
  berichten: null,
  opmerkingen: null,
};

const scherm = () => $('#scherm');

/** Niet opnieuw tekenen terwijl iemand typt of een venster openstaat. */
function storendMoment() {
  if (document.querySelector('.overlay')) return true;
  const actief = document.activeElement;
  return !!actief && ['INPUT', 'TEXTAREA', 'SELECT'].includes(actief.tagName);
}

/* -------------------------------------------------------------------- start */

async function begin() {
  try {
    staat.start = await zorgVoorToegang();
  } catch (fout) {
    return toonFout(fout);
  }
  staat.week = { jaar: staat.start.huidigeWeek.jaar, weeknummer: staat.start.huidigeWeek.weeknummer };
  werkTabsBij();

  $('#tabs').addEventListener('click', (e) => {
    const knop = e.target.closest('.tab');
    if (knop) kiesTab(knop.dataset.tab);
  });

  const uitHash = location.hash.replace('#', '');
  await kiesTab(['week', 'bibliotheek', 'historie', 'berichten'].includes(uitHash) ? uitHash : 'week');

  document.addEventListener('wachtrij-leeg', () => {
    if (staat.tab === 'week' && !storendMoment()) laadWeek({ stil: true });
  });
  wachtrij.verwerk();
}

async function kiesTab(tab) {
  staat.tab = tab;
  location.hash = tab;
  for (const knop of $$('.tab')) knop.setAttribute('aria-selected', String(knop.dataset.tab === tab));
  leeg(scherm()).append(el('div', { class: 'laadskelet', 'aria-hidden': 'true' }, [el('div'), el('div'), el('div')]));
  try {
    if (tab === 'week') await laadWeek();
    else if (tab === 'bibliotheek') await laadBibliotheek();
    else if (tab === 'historie') await laadHistorie();
    else if (tab === 'berichten') await laadBerichten();
  } catch (fout) {
    toonFout(fout);
  }
}

function werkTabsBij() {
  const knop = $$('.tab').find((k) => k.dataset.tab === 'berichten');
  const bestaand = knop.querySelector('.bolletje');
  if (bestaand) bestaand.remove();
  const n = staat.start?.ongelezenBerichten || 0;
  if (n > 0) knop.append(el('span', { class: 'bolletje', tekst: String(n), title: 'ongelezen' }));
}

function toonFout(fout) {
  leeg(scherm()).append(el('div', { class: 'leeg' }, [
    el('div', { class: 'groot', tekst: '⚠️' }),
    el('p', { tekst: fout.netwerk ? 'Geen verbinding met de app.' : fout.message }),
    el('button', { class: 'knop primair', tekst: 'Opnieuw proberen', onclick: () => kiesTab(staat.tab) }),
  ]));
}

/* ------------------------------------------------------- tab 1: week samenstellen */

async function laadWeek({ stil = false } = {}) {
  const data = await api.haal(`/api/samensteller/${staat.week.jaar}/${staat.week.weeknummer}`);
  staat.samensteller = data;
  if (!stil || staat.tab === 'week') tekenWeek();
}

function tekenWeek() {
  const { week, groepen, aantalGeselecteerd } = staat.samensteller;
  const alle = groepen.flatMap((g) => g.taken);
  const geselecteerd = alle.filter((t) => t.geselecteerd);
  const minuten = geselecteerd.reduce((som, t) => som + (t.geschatteMinuten || 0), 0);
  const isHuidige = week.jaar === staat.start.huidigeWeek.jaar && week.weeknummer === staat.start.huidigeWeek.weeknummer;

  const doel = leeg(scherm());

  /* Weekkiezer */
  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-binnen' }, [
      el('div', { class: 'rij', stijl: { marginBottom: '10px' } }, [
        el('button', { class: 'knop klein', tekst: '← Vorige', onclick: () => verschuifWeek(-1) }),
        el('div', { stijl: { flex: '1', textAlign: 'center', minWidth: '0' } }, [
          el('div', { stijl: { fontWeight: '650' }, tekst: `Week ${week.weeknummer} · ${week.jaar}` }),
          el('div', { class: 'klein stil', tekst: `vanaf ${langeDatum(week.startdatum)}` }),
        ]),
        el('button', { class: 'knop klein', tekst: 'Volgende →', onclick: () => verschuifWeek(1) }),
      ]),
      !isHuidige ? el('div', { class: 'rij', stijl: { justifyContent: 'center' } }, [
        el('button', { class: 'knop klein stil', tekst: 'Naar deze week', onclick: () => gaNaarHuidigeWeek() }),
      ]) : null,
    ]),
  ]));

  /* Notitie */
  const notitieVeld = el('textarea', {
    id: 'weeknotitie', placeholder: 'Bijvoorbeeld: deze week extra aandacht voor de vensterbanken.',
    maxlength: '1000',
  });
  notitieVeld.value = week.notitie || '';
  let notitieTimer = null;
  notitieVeld.addEventListener('input', () => {
    clearTimeout(notitieTimer);
    notitieTimer = setTimeout(() => {
      week.notitie = notitieVeld.value;
      wachtrij.voegToe({
        sleutel: `notitie:${week.id}`, methode: 'PUT',
        pad: `/api/weken/${week.id}/notitie`, body: { notitie: notitieVeld.value },
      });
    }, 700);
  });

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Notitie voor deze week' })]),
    el('div', { class: 'kaart-binnen' }, [
      notitieVeld,
      el('p', { class: 'hulp', tekst: 'Verschijnt bovenaan bij de schoonmaakster. Wordt vanzelf opgeslagen.' }),
    ]),
  ]));

  /* Samenvatting + snelknoppen */
  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-binnen' }, [
      el('div', { class: 'rij', stijl: { flexWrap: 'wrap', gap: '8px', marginBottom: '12px' } }, [
        el('span', { class: 'label accent', tekst: `${meervoud(aantalGeselecteerd, 'taak', 'taken')} gepland` }),
        minuten ? el('span', { class: 'label', tekst: `± ${Math.round(minuten / 5) * 5} minuten` }) : null,
        el('span', { class: 'label stil', tekst: `${alle.length} taken in de bibliotheek` }),
      ]),
      el('div', { class: 'knoppenrij' }, [
        el('button', { class: 'knop klein', tekst: '↺ Kopieer vorige week', onclick: kopieerVorigeWeek }),
        el('button', { class: 'knop klein', tekst: '✓ Alles wekelijks aanzetten', onclick: () => zetWekelijks() }),
        el('button', { class: 'knop klein gevaar', tekst: 'Alles uit', onclick: () => zetAlles([]) }),
      ]),
    ]),
  ]));

  /* Takenlijst met "hoe lang geleden" */
  for (const groep of groepen) {
    const aantal = groep.taken.filter((t) => t.geselecteerd).length;
    doel.append(
      el('div', { class: 'ruimte-kop' }, [
        el('h2', { tekst: groep.ruimteNaam }),
        el('span', { class: 'aantal', tekst: `${aantal}/${groep.taken.length}` }),
      ]),
      el('ul', { class: 'taaklijst' }, groep.taken.map(tekenSamenstellerTaak)),
    );
  }

  if (!alle.length) {
    doel.append(el('div', { class: 'leeg' }, [
      el('p', { tekst: 'Er staan nog geen taken in de bibliotheek.' }),
      el('button', { class: 'knop primair', tekst: 'Naar de takenbibliotheek', onclick: () => kiesTab('bibliotheek') }),
    ]));
  }
}

function tekenSamenstellerTaak(taak) {
  const laat = taak.wekenGeleden === null || taak.wekenGeleden >= 4;
  const rij = el('button', {
    class: 'taak-rij', type: 'button', 'aria-pressed': taak.geselecteerd ? 'true' : 'false',
    onclick: () => wisselTaakInWeek(taak),
  }, [
    el('span', { class: 'vink', 'aria-hidden': 'true' }, [vinkIcoon()]),
    el('span', { class: 'taak-midden' }, [
      el('span', { class: 'taak-titel', tekst: taak.titel }),
      el('span', { class: 'taak-meta' }, [
        el('span', {
          class: `label${laat ? ' waarschuwing' : taak.wekenGeleden === 0 ? ' accent' : ''}`,
          tekst: wekenGeledenTekst(taak.wekenGeleden),
        }),
        el('span', { class: 'label stil', tekst: taak.standaardFrequentie }),
        taak.geschatteMinuten ? el('span', { class: 'label stil', tekst: `${taak.geschatteMinuten} min` }) : null,
      ]),
    ]),
  ]);

  return el('li', { class: `taak${taak.geselecteerd ? ' gekozen' : ''}` }, [
    el('div', { class: 'taak-hoofd' }, [
      rij,
      taak.fotoId ? el('button', {
        class: 'foto-knop', type: 'button', 'aria-label': `Foto bij ${taak.titel}`,
        onclick: () => toonFoto(api.fotoUrl(taak.fotoId), taak.titel),
      }, [el('img', { class: 'duim', src: api.fotoUrl(taak.fotoId), alt: '', loading: 'lazy' })]) : null,
    ]),
  ]);
}

function huidigeSelectie() {
  return staat.samensteller.groepen.flatMap((g) => g.taken).filter((t) => t.geselecteerd).map((t) => t.id);
}

function wisselTaakInWeek(taak) {
  taak.geselecteerd = !taak.geselecteerd;
  bewaarSelectie(huidigeSelectie());
}

function zetAlles(taakIds) {
  const set = new Set(taakIds);
  for (const taak of staat.samensteller.groepen.flatMap((g) => g.taken)) taak.geselecteerd = set.has(taak.id);
  bewaarSelectie([...set]);
}

function zetWekelijks() {
  const alle = staat.samensteller.groepen.flatMap((g) => g.taken);
  const ids = new Set(huidigeSelectie());
  for (const taak of alle) if (taak.standaardFrequentie === 'wekelijks') ids.add(taak.id);
  zetAlles([...ids]);
}

function bewaarSelectie(taakIds) {
  staat.samensteller.aantalGeselecteerd = taakIds.length;
  tekenWeek();
  wachtrij.voegToe({
    sleutel: `weektaken:${staat.samensteller.week.id}`,
    methode: 'PUT',
    pad: `/api/weken/${staat.samensteller.week.id}/taken`,
    body: { taakIds },
  });
}

async function kopieerVorigeWeek() {
  try {
    meld('Bezig…', 'bezig');
    const data = await api.stuur('POST', `/api/weken/${staat.samensteller.week.id}/kopieer-vorige`);
    staat.samensteller = {
      week: data.week, groepen: data.groepen,
      aantalGeselecteerd: data.aantalGeselecteerd, navigatie: data.navigatie,
    };
    tekenWeek();
    meld(data.gekopieerd ? `${meervoud(data.gekopieerd, 'taak', 'taken')} overgenomen` : 'Vorige week was leeg', 'goed');
  } catch (fout) {
    meld(fout.message, 'fout', { duur: 4000 });
  }
}

function verschuifWeek(richting) {
  const { vorige, volgende } = staat.samensteller.navigatie;
  staat.week = richting < 0 ? vorige : volgende;
  laadWeek();
}

function gaNaarHuidigeWeek() {
  staat.week = { jaar: staat.start.huidigeWeek.jaar, weeknummer: staat.start.huidigeWeek.weeknummer };
  laadWeek();
}


/* ---------------------------------------------------- tab 2: takenbibliotheek */

let toonGearchiveerd = false;

async function laadBibliotheek() {
  staat.bibliotheek = await api.haal('/api/taken', { alles: '1' });
  tekenBibliotheek();
}

function tekenBibliotheek() {
  const { taken, ruimtes } = staat.bibliotheek;
  const zichtbaar = taken.filter((t) => toonGearchiveerd || t.actief);
  const doel = leeg(scherm());

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-binnen' }, [
      el('div', { class: 'knoppenrij' }, [
        el('button', { class: 'knop primair', tekst: '+ Nieuwe taak', onclick: () => bewerkTaak(null) }),
        el('button', { class: 'knop', tekst: '⌂ Ruimtes', onclick: beheerRuimtes }),
        el('button', {
          class: 'knop stil klein',
          tekst: toonGearchiveerd ? 'Verberg gearchiveerd' : 'Toon gearchiveerd',
          onclick: () => { toonGearchiveerd = !toonGearchiveerd; tekenBibliotheek(); },
        }),
      ]),
      el('p', { class: 'hulp', tekst: `${meervoud(taken.filter((t) => t.actief).length, 'actieve taak', 'actieve taken')} in ${meervoud(ruimtes.filter((r) => r.actief).length, 'ruimte', 'ruimtes')}.` }),
    ]),
  ]));

  const perRuimte = new Map(ruimtes.map((r) => [r.id, []]));
  for (const taak of zichtbaar) {
    if (!perRuimte.has(taak.ruimteId)) perRuimte.set(taak.ruimteId, []);
    perRuimte.get(taak.ruimteId).push(taak);
  }

  for (const ruimte of ruimtes) {
    const lijst = perRuimte.get(ruimte.id) || [];
    if (!lijst.length && !ruimte.actief) continue;
    doel.append(
      el('div', { class: 'ruimte-kop' }, [
        el('h2', { tekst: ruimte.naam }),
        !ruimte.actief ? el('span', { class: 'label', tekst: 'gearchiveerd' }) : null,
        el('span', { class: 'aantal', tekst: meervoud(lijst.length, 'taak', 'taken') }),
      ]),
      lijst.length
        ? el('ul', { class: 'taaklijst' }, lijst.map((taak, i) => tekenBibliotheekTaak(taak, lijst, i)))
        : el('p', { class: 'hulp', stijl: { padding: '0 4px' }, tekst: 'Nog geen taken in deze ruimte.' }),
    );
  }
}

function tekenBibliotheekTaak(taak, lijst, index) {
  return el('li', { class: `taak${taak.actief ? '' : ' gearchiveerd'}` }, [
    el('div', { class: 'taak-hoofd' }, [
      el('button', {
        class: 'taak-rij', type: 'button', onclick: () => bewerkTaak(taak),
      }, [
        el('span', { class: 'taak-midden' }, [
          el('span', { class: 'taak-titel', tekst: taak.titel }),
          taak.omschrijving ? el('span', { class: 'taak-omschrijving', tekst: taak.omschrijving }) : null,
          el('span', { class: 'taak-meta' }, [
            el('span', { class: 'label', tekst: taak.standaardFrequentie }),
            taak.geschatteMinuten ? el('span', { class: 'label stil', tekst: `${taak.geschatteMinuten} min` }) : null,
            !taak.actief ? el('span', { class: 'label waarschuwing', tekst: 'gearchiveerd' }) : null,
            !taak.fotoId ? el('span', { class: 'label stil', tekst: 'geen foto' }) : null,
          ]),
        ]),
      ]),
      taak.fotoId ? el('button', {
        class: 'foto-knop', type: 'button', 'aria-label': `Foto bij ${taak.titel}`,
        onclick: () => toonFoto(api.fotoUrl(taak.fotoId), taak.titel),
      }, [el('img', { class: 'duim', src: api.fotoUrl(taak.fotoId), alt: '', loading: 'lazy' })]) : null,
    ]),
    el('div', { class: 'taak-voet', stijl: { paddingLeft: '14px' } }, [
      el('button', {
        class: 'knop klein', tekst: '↑', 'aria-label': 'Omhoog', disabled: index === 0,
        onclick: () => verplaatsTaak(lijst, index, -1),
      }),
      el('button', {
        class: 'knop klein', tekst: '↓', 'aria-label': 'Omlaag', disabled: index === lijst.length - 1,
        onclick: () => verplaatsTaak(lijst, index, 1),
      }),
      el('button', { class: 'knop klein stil', tekst: 'Bewerken', onclick: () => bewerkTaak(taak) }),
      el('button', {
        class: 'knop klein stil', tekst: 'Historie', onclick: () => toonTaakHistorie(taak.id),
      }),
    ]),
  ]);
}

async function verplaatsTaak(lijst, index, richting) {
  const doel = index + richting;
  if (doel < 0 || doel >= lijst.length) return;
  [lijst[index], lijst[doel]] = [lijst[doel], lijst[index]];
  tekenBibliotheek();
  try {
    await api.stuur('POST', '/api/taken/volgorde', { ids: lijst.map((t) => t.id) });
    await laadBibliotheek();
  } catch (fout) {
    meld(fout.message, 'fout', { duur: 4000 });
  }
}

function bewerkTaak(taak) {
  const nieuw = !taak;
  const velden = {
    titel: taak?.titel || '',
    ruimteId: taak?.ruimteId || staat.bibliotheek.ruimtes.find((r) => r.actief)?.id,
    omschrijving: taak?.omschrijving || '',
    standaardFrequentie: taak?.standaardFrequentie || 'wekelijks',
    geschatteMinuten: taak?.geschatteMinuten ?? '',
    fotoId: taak?.fotoId ?? null,
    actief: taak ? taak.actief : true,
  };

  const titelVeld = el('input', { type: 'text', maxlength: '120', placeholder: 'Bijv. Badkamer: douchewand' });
  titelVeld.value = velden.titel;

  const ruimteVeld = el('select', {}, staat.bibliotheek.ruimtes
    .filter((r) => r.actief || r.id === velden.ruimteId)
    .map((r) => el('option', { value: r.id, tekst: r.naam + (r.actief ? '' : ' (gearchiveerd)') })));
  ruimteVeld.value = velden.ruimteId;

  const omschrijvingVeld = el('textarea', {
    maxlength: '2000', placeholder: 'Korte instructie in gewone taal. Noem het schoonmaakmiddel als dat uitmaakt.',
  });
  omschrijvingVeld.value = velden.omschrijving;

  const frequentieVeld = el('select', {}, staat.start.frequenties.map((f) => el('option', { value: f, tekst: f })));
  frequentieVeld.value = velden.standaardFrequentie;

  const minutenVeld = el('input', { type: 'number', min: '0', max: '480', step: '5', placeholder: 'bijv. 10' });
  minutenVeld.value = velden.geschatteMinuten;

  const fotoVak = el('div');
  const bestandVeld = el('input', {
    type: 'file', accept: 'image/*', stijl: { display: 'none' },
    onchange: async (e) => {
      const bestand = e.target.files?.[0];
      e.target.value = '';
      if (!bestand) return;
      try {
        meld('Foto verkleinen…', 'bezig');
        const blob = await verkleinAfbeelding(bestand);
        meld('Foto uploaden…', 'bezig');
        const foto = await api.uploadFoto(blob);
        velden.fotoId = foto.id;
        tekenFotoVak();
        meld(`Foto opgeslagen (${Math.round(foto.bytes / 1024)} kB)`, 'goed');
      } catch (fout) {
        meld(fout.message || 'Foto uploaden mislukt.', 'fout', { duur: 5000 });
      }
    },
  });

  function tekenFotoVak() {
    leeg(fotoVak).append(
      velden.fotoId
        ? el('div', { class: 'rij', stijl: { marginBottom: '8px' } }, [
          el('img', {
            src: api.fotoUrl(velden.fotoId), alt: 'Voorbeeldfoto',
            stijl: { width: '86px', height: '86px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--rand)' },
            onclick: () => toonFoto(api.fotoUrl(velden.fotoId), titelVeld.value),
          }),
          el('div', { class: 'knoppenrij' }, [
            el('button', { class: 'knop klein', type: 'button', tekst: 'Vervangen', onclick: () => bestandVeld.click() }),
            el('button', {
              class: 'knop klein gevaar', type: 'button', tekst: 'Verwijderen',
              onclick: () => { velden.fotoId = null; tekenFotoVak(); },
            }),
          ]),
        ])
        : el('button', { class: 'knop', type: 'button', tekst: '📷 Foto kiezen', onclick: () => bestandVeld.click() }),
      el('p', { class: 'hulp', tekst: 'De foto wordt automatisch verkleind voordat hij wordt geüpload.' }),
    );
  }
  tekenFotoVak();

  const modaal = toonModaal({
    titel: nieuw ? 'Nieuwe taak' : 'Taak bewerken',
    inhoud: [
      el('label', { class: 'veld' }, [el('span', { tekst: 'Titel' }), titelVeld]),
      el('label', { class: 'veld' }, [el('span', { tekst: 'Ruimte' }), ruimteVeld]),
      el('label', { class: 'veld' }, [el('span', { tekst: 'Omschrijving' }), omschrijvingVeld]),
      el('div', { class: 'velden-rij' }, [
        el('label', { class: 'veld' }, [el('span', { tekst: 'Standaardfrequentie' }), frequentieVeld]),
        el('label', { class: 'veld' }, [el('span', { tekst: 'Geschatte minuten' }), minutenVeld]),
      ]),
      el('label', { class: 'veld' }, [el('span', { tekst: 'Voorbeeldfoto' }), fotoVak]),
      bestandVeld,
      !nieuw ? el('div', { class: 'knoppenrij', stijl: { marginTop: '4px' } }, [
        el('button', {
          class: 'knop klein gevaar', type: 'button',
          tekst: taak.actief ? 'Archiveren' : 'Terugzetten uit archief',
          onclick: async () => {
            await bewaarTaak(taak.id, { actief: !taak.actief });
            modaal.sluit();
          },
        }),
      ]) : null,
    ],
    knoppen: [
      { tekst: 'Annuleren', bij: () => modaal.sluit() },
      {
        tekst: 'Opslaan', primair: true,
        bij: async () => {
          const gegevens = {
            titel: titelVeld.value.trim(),
            ruimteId: Number(ruimteVeld.value),
            omschrijving: omschrijvingVeld.value.trim(),
            standaardFrequentie: frequentieVeld.value,
            geschatteMinuten: minutenVeld.value === '' ? null : Number(minutenVeld.value),
            fotoId: velden.fotoId,
          };
          if (!gegevens.titel) {
            titelVeld.focus();
            return meld('Geef de taak een titel.', 'fout', { duur: 3000 });
          }
          await bewaarTaak(taak?.id ?? null, gegevens);
          modaal.sluit();
        },
      },
    ],
  });
  setTimeout(() => titelVeld.focus(), 80);
}

async function bewaarTaak(id, gegevens) {
  try {
    if (id) await api.stuur('PUT', `/api/taken/${id}`, gegevens);
    else await api.stuur('POST', '/api/taken', gegevens);
    await laadBibliotheek();
    meld('Opgeslagen', 'goed');
  } catch (fout) {
    meld(fout.message, 'fout', { duur: 5000 });
  }
}

function beheerRuimtes() {
  const lijst = el('div');

  function teken() {
    const ruimtes = staat.bibliotheek.ruimtes;
    leeg(lijst).append(...ruimtes.map((ruimte, i) => {
      const naamVeld = el('input', { type: 'text', maxlength: '60', stijl: { flex: '1' } });
      naamVeld.value = ruimte.naam;
      naamVeld.addEventListener('change', async () => {
        const naam = naamVeld.value.trim();
        if (!naam || naam === ruimte.naam) return;
        await bewaarRuimte(ruimte.id, { naam });
        teken();
      });
      return el('div', { class: 'rij', stijl: { marginBottom: '8px', flexWrap: 'wrap' } }, [
        naamVeld,
        el('button', {
          class: 'knop klein', tekst: '↑', 'aria-label': 'Omhoog', disabled: i === 0,
          onclick: async () => {
            [ruimtes[i], ruimtes[i - 1]] = [ruimtes[i - 1], ruimtes[i]];
            teken();
            await api.stuur('POST', '/api/ruimtes/volgorde', { ids: ruimtes.map((r) => r.id) });
          },
        }),
        el('button', {
          class: 'knop klein', tekst: '↓', 'aria-label': 'Omlaag', disabled: i === ruimtes.length - 1,
          onclick: async () => {
            [ruimtes[i], ruimtes[i + 1]] = [ruimtes[i + 1], ruimtes[i]];
            teken();
            await api.stuur('POST', '/api/ruimtes/volgorde', { ids: ruimtes.map((r) => r.id) });
          },
        }),
        el('button', {
          class: `knop klein${ruimte.actief ? ' gevaar' : ''}`,
          tekst: ruimte.actief ? 'Archiveren' : 'Terug',
          onclick: async () => { await bewaarRuimte(ruimte.id, { actief: !ruimte.actief }); teken(); },
        }),
      ]);
    }));
  }

  const nieuwVeld = el('input', { type: 'text', maxlength: '60', placeholder: 'Naam van de ruimte' });
  teken();

  const modaal = toonModaal({
    titel: 'Ruimtes',
    inhoud: [
      lijst,
      el('hr', { class: 'scheider' }),
      el('div', { class: 'rij' }, [
        nieuwVeld,
        el('button', {
          class: 'knop primair', type: 'button', tekst: 'Toevoegen',
          onclick: async () => {
            const naam = nieuwVeld.value.trim();
            if (!naam) return;
            try {
              await api.stuur('POST', '/api/ruimtes', { naam });
              nieuwVeld.value = '';
              await laadBibliotheek();
              teken();
            } catch (fout) {
              meld(fout.message, 'fout', { duur: 4000 });
            }
          },
        }),
      ]),
    ],
    knoppen: [{ tekst: 'Klaar', primair: true, bij: () => { modaal.sluit(); laadBibliotheek(); } }],
  });
}

async function bewaarRuimte(id, gegevens) {
  try {
    await api.stuur('PUT', `/api/ruimtes/${id}`, gegevens);
    staat.bibliotheek = await api.haal('/api/taken', { alles: '1' });
  } catch (fout) {
    meld(fout.message, 'fout', { duur: 4000 });
  }
}

/* ------------------------------------------------------- tab 3: historie */

async function laadHistorie() {
  const [historie, bibliotheek] = await Promise.all([
    api.haal('/api/historie', { limiet: 12 }),
    staat.bibliotheek ? Promise.resolve(staat.bibliotheek) : api.haal('/api/taken'),
  ]);
  staat.historie = historie.weken;
  staat.bibliotheek = staat.bibliotheek || bibliotheek;
  tekenHistorie();
}

function tekenHistorie() {
  const doel = leeg(scherm());

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Laatste weken' })]),
    staat.historie.length
      ? el('div', {}, staat.historie.map(tekenHistorieWeek))
      : el('div', { class: 'kaart-binnen' }, [el('p', { class: 'stil', tekst: 'Nog geen weken met taken.' })]),
  ]));

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Per taak' })]),
    el('div', { class: 'kaart-binnen' }, [
      el('p', { class: 'hulp', tekst: 'Tik op een taak om te zien wanneer die de afgelopen tijd gedaan is.' }),
      el('div', {}, staat.bibliotheek.taken.filter((t) => t.actief).map((taak) => el('button', {
        class: 'knop klein', stijl: { margin: '0 6px 6px 0' },
        tekst: `${taak.ruimteNaam} · ${taak.titel}`,
        onclick: () => toonTaakHistorie(taak.id),
      }))),
    ]),
  ]));
}

function tekenHistorieWeek(week) {
  const percentage = week.gepland ? Math.round((week.afgevinkt / week.gepland) * 100) : 0;
  const isHuidige = week.jaar === staat.start.huidigeWeek.jaar && week.weeknummer === staat.start.huidigeWeek.weeknummer;
  return el('div', { stijl: { borderTop: '1px solid var(--rand)' } }, [
    el('button', {
      class: 'taak-rij', type: 'button', onclick: (e) => wisselWeekDetail(week, e.currentTarget.parentElement),
    }, [
      el('span', { class: 'taak-midden' }, [
        el('span', { class: 'taak-titel', tekst: `Week ${week.weeknummer}${isHuidige ? ' — deze week' : ''}` }),
        el('span', { class: 'klein stil', tekst: `vanaf ${langeDatum(week.startdatum)}` }),
        el('span', { class: 'taak-meta' }, [
          el('span', {
            class: `label${percentage === 100 ? ' accent' : percentage < 50 ? ' waarschuwing' : ''}`,
            tekst: `${week.afgevinkt} van ${week.gepland} gedaan`,
          }),
          week.notitie ? el('span', { class: 'label stil', tekst: '✎ notitie' }) : null,
        ]),
        el('span', { class: 'balk', stijl: { marginTop: '8px', display: 'block' } }, [
          el('span', { class: 'balk-vulling', stijl: { width: `${percentage}%`, display: 'block' } }),
        ]),
      ]),
    ]),
  ]);
}

async function wisselWeekDetail(week, houder) {
  const bestaand = houder.querySelector('.week-detail');
  if (bestaand) return bestaand.remove();
  const detail = el('div', { class: 'week-detail', stijl: { padding: '0 14px 14px' } }, [
    el('p', { class: 'stil klein', tekst: 'Laden…' }),
  ]);
  houder.append(detail);
  try {
    const data = await api.haal(`/api/week/${week.jaar}/${week.weeknummer}`);
    voegToe(
      leeg(detail),
      data.week.notitie ? el('div', { class: 'notitie' }, [
        el('div', { class: 'label', tekst: 'Notitie' }), el('p', { tekst: data.week.notitie }),
      ]) : null,
      ...data.groepen.map((groep) => el('div', { stijl: { marginBottom: '10px' } }, [
        el('div', { class: 'klein', stijl: { fontWeight: '650', marginBottom: '4px' }, tekst: groep.ruimteNaam }),
        ...groep.taken.map((taak) => el('div', { class: 'klein', stijl: { display: 'flex', gap: '8px', padding: '3px 0' } }, [
          el('span', { tekst: taak.afgevinkt ? '✅' : '⬜️' }),
          el('span', { stijl: { flex: '1' } }, [
            taak.titel,
            taak.afgevinkt ? el('span', { class: 'stil', tekst: ` — ${tijdstempel(taak.afgevinktOp)}` }) : null,
            taak.opmerking ? el('div', { class: 'opmerking-weergave', stijl: { marginTop: '4px' }, tekst: taak.opmerking }) : null,
          ]),
        ])),
      ])),
      data.berichten.length ? el('div', { class: 'hulp', tekst: `${meervoud(data.berichten.length, 'bericht', 'berichten')} deze week — zie tabblad Berichten.` }) : null,
    );
  } catch (fout) {
    leeg(detail).append(el('p', { class: 'stil klein', tekst: fout.message }));
  }
}

async function toonTaakHistorie(taakId) {
  const lijf = el('div', {}, [el('p', { class: 'stil', tekst: 'Laden…' })]);
  const modaal = toonModaal({
    titel: 'Historie van deze taak',
    inhoud: [lijf],
    knoppen: [{ tekst: 'Sluiten', primair: true, bij: () => modaal.sluit() }],
  });
  try {
    const data = await api.haal(`/api/taken/${taakId}/historie`);
    const gedaan = data.historie.filter((h) => h.afgevinkt);
    voegToe(
      leeg(lijf),
      el('h3', { tekst: data.taak.titel }),
      el('p', { class: 'stil klein', tekst: data.taak.ruimteNaam }),
      el('p', { class: 'label accent', tekst: gedaan.length ? `Laatst gedaan: week ${gedaan[0].weeknummer} (${korteDatum(gedaan[0].startdatum)})` : 'Nog nooit afgevinkt' }),
      el('hr', { class: 'scheider' }),
      data.historie.length
        ? el('div', {}, data.historie.map((h) => el('div', { class: 'rij klein', stijl: { padding: '5px 0', borderBottom: '1px solid var(--rand)' } }, [
          el('span', { tekst: h.afgevinkt ? '✅' : '⬜️' }),
          el('span', { stijl: { flex: '1' } }, [
            `Week ${h.weeknummer} · ${korteDatum(h.startdatum)}`,
            h.afgevinkt && h.afgevinktOp ? el('span', { class: 'stil', tekst: ` — ${tijdstempel(h.afgevinktOp)}` }) : null,
            h.opmerking ? el('div', { class: 'opmerking-weergave', stijl: { marginTop: '4px' }, tekst: h.opmerking }) : null,
          ]),
        ])))
        : el('p', { class: 'stil', tekst: 'Deze taak is nog niet op een weeklijst gezet.' }),
    );
  } catch (fout) {
    leeg(lijf).append(el('p', { class: 'stil', tekst: fout.message }));
  }
}

/* ------------------------------------------------------- tab 4: berichten */

async function laadBerichten() {
  const [berichten, opmerkingen] = await Promise.all([
    api.haal('/api/berichten', { limiet: 100 }),
    api.haal('/api/opmerkingen'),
  ]);
  staat.berichten = berichten.berichten;
  staat.opmerkingen = opmerkingen.opmerkingen;
  tekenBerichten();
}

function tekenBerichten() {
  const doel = leeg(scherm());
  const ongelezen = staat.berichten.filter((b) => !b.gelezen && b.afzender === 'schoonmaakster');

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [
      el('h2', { tekst: 'Berichten' }),
      ongelezen.length ? el('button', {
        class: 'knop klein stil', tekst: 'Alles gelezen',
        onclick: async () => {
          await api.stuur('POST', '/api/berichten/gelezen-alles');
          staat.start.ongelezenBerichten = 0;
          werkTabsBij();
          await laadBerichten();
        },
      }) : null,
    ]),
    el('div', { class: 'kaart-binnen' }, [
      el('button', { class: 'knop primair', tekst: '✉ Bericht sturen', onclick: berichtSturen }),
    ]),
    staat.berichten.length
      ? el('div', {}, staat.berichten.map(tekenBericht))
      : el('div', { class: 'kaart-binnen' }, [el('p', { class: 'stil', tekst: 'Nog geen berichten.' })]),
  ]));

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Opmerkingen bij taken' })]),
    staat.opmerkingen.length
      ? el('div', { class: 'kaart-binnen' }, staat.opmerkingen.map((o) => el('div', { stijl: { marginBottom: '14px' } }, [
        el('div', { class: 'klein stil', tekst: `Week ${o.weeknummer} · ${o.ruimteNaam} · ${o.titel}${o.afgevinkt ? '' : ' (niet afgevinkt)'}` }),
        el('div', { class: 'opmerking-weergave', tekst: o.opmerking }),
      ])))
      : el('div', { class: 'kaart-binnen' }, [el('p', { class: 'stil', tekst: 'Nog geen opmerkingen bij taken.' })]),
  ]));
}

function tekenBericht(bericht) {
  const vanHulp = bericht.afzender === 'schoonmaakster';
  const ongelezen = !bericht.gelezen && vanHulp;
  return el('div', {
    stijl: {
      borderTop: '1px solid var(--rand)', padding: '13px 16px',
      background: ongelezen ? 'var(--accent-zacht)' : 'transparent',
    },
  }, [
    el('div', { class: 'rij klein stil', stijl: { marginBottom: '4px' } }, [
      el('span', { tekst: vanHulp ? 'Van de schoonmaakster' : 'Van jou' }),
      el('span', { tekst: '·' }),
      el('span', { tekst: tijdstempel(bericht.aangemaaktOp) }),
      bericht.weeknummer ? el('span', { class: 'label stil', tekst: `week ${bericht.weeknummer}` }) : null,
      ongelezen ? el('span', { class: 'label waarschuwing duw', tekst: 'nieuw' }) : null,
    ]),
    el('div', { tekst: bericht.tekst, stijl: { whiteSpace: 'pre-wrap' } }),
    ongelezen ? el('button', {
      class: 'knop klein stil', stijl: { marginTop: '6px' }, tekst: 'Markeer als gelezen',
      onclick: async () => {
        await api.stuur('PUT', `/api/berichten/${bericht.id}/gelezen`, { gelezen: true });
        bericht.gelezen = true;
        staat.start.ongelezenBerichten = Math.max(0, staat.start.ongelezenBerichten - 1);
        werkTabsBij();
        tekenBerichten();
      },
    }) : null,
  ]);
}

function berichtSturen() {
  const invoer = el('textarea', { maxlength: '2000', placeholder: 'Bijvoorbeeld: nieuwe allesreiniger staat onder de gootsteen.' });
  const modaal = toonModaal({
    titel: 'Bericht sturen',
    ondertitel: 'De schoonmaakster ziet dit onderaan haar weeklijst.',
    inhoud: [invoer],
    knoppen: [
      { tekst: 'Annuleren', bij: () => modaal.sluit() },
      {
        tekst: 'Versturen', primair: true,
        bij: async () => {
          const tekst = invoer.value.trim();
          if (!tekst) return modaal.sluit();
          try {
            await api.stuur('POST', '/api/berichten', {
              tekst, weekId: staat.samensteller?.week?.id ?? null,
              clientId: `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            });
            modaal.sluit();
            await laadBerichten();
            meld('Bericht verstuurd', 'goed');
          } catch (fout) {
            meld(fout.message, 'fout', { duur: 4000 });
          }
        },
      },
    ],
  });
  setTimeout(() => invoer.focus(), 80);
}

/* ------------------------------------------------------------------- modaal */

function toonModaal({ titel, ondertitel, inhoud, knoppen }) {
  const overlay = el('div', { class: 'overlay' });
  const sluit = () => overlay.remove();
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

export { begin };
begin();
