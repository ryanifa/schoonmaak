/* Beheerdersweergave: bibliotheek, week samenstellen, historie en berichten. */

import { haalToegang, vergeetToegang } from './config.js';
import { Opslag } from './opslag.js';
import { FotoOpslag } from './fotos.js';
import { volgOpslag } from './status.js';
import { toonFoto } from './fotoscherm.js';
import { toonModaal } from './modaal.js';
import { meld } from './melding.js';
import {
  FREQUENTIES, TAAKTYPES, TAAKTYPE_LABEL, RESULTAAT_LABEL, resultaatTelling,
  weekSleutel, nieuwId, ruimteLijst, taakLijst, weekOverzicht,
  weekSamensteller, historie, taakHistorie, alleOpmerkingen, aantalOngelezen,
  takenVanVorigeWeek, lopendBezoek, gewerkteMinuten, alsDuur, haalWeek,
  schoonmakerLijst, standaardSchoonmaker, schoonmakerNaam, historieOmvang, groepeerPerRuimte,
} from './document.js';
import { versieRegel } from './versie.js';
import { toonTestbalkIndienNodig } from './testbanner.js';
import { huidigeWeek } from './week.js';
import {
  el, leeg, voegToe, behoudPlek, naarBoven, $, $$, langeDatum, korteDatum, tijdstempel,
  wekenGeledenTekst, meervoud, vinkIcoon, verkleinAfbeelding, alsBase64,
} from './util.js';

const toegang = haalToegang('beheerder');
let opslag = null;
let fotos = null;
let tab = 'week';
let week = huidigeWeek();
let toonGearchiveerd = false;

const scherm = () => $('#scherm');
const doc = () => opslag.document();

/** Niet opnieuw tekenen terwijl iemand typt of een venster openstaat. */
function storendMoment() {
  if (document.querySelector('.overlay')) return true;
  const actief = document.activeElement;
  return !!actief && ['INPUT', 'TEXTAREA', 'SELECT'].includes(actief.tagName);
}

async function begin() {
  if (!toegang) {
    return voegToe(leeg(scherm()), el('div', { class: 'leeg' }, [
      el('div', { class: 'groot', tekst: '🔑' }),
      el('h2', { tekst: 'Nog niet ingericht' }),
      el('p', { tekst: 'Open eerst de inrichtingspagina en vul daar je sleutel in.' }),
      el('a', { class: 'knop primair', href: './index.html', tekst: 'Naar inrichten' }),
    ]));
  }

  toonTestbalkIndienNodig(toegang);
  if (toegang.test) {
    // Een testlink kan ook rechtstreeks geopend worden; dan is er nog niets gevuld.
    const { zorgVoorTestgegevens } = await import('./testdata.js');
    await zorgVoorTestgegevens();
  }
  opslag = new Opslag(toegang);
  fotos = new FotoOpslag(toegang);
  volgOpslag(opslag);
  opslag.addEventListener('verandering', () => { if (!storendMoment()) teken(); });
  fotos.addEventListener('verandering', () => { if (!storendMoment()) teken(); });

  $('#tabs').addEventListener('click', (e) => {
    const knop = e.target.closest('.tab');
    if (knop) kiesTab(knop.dataset.tab);
  });

  try {
    await opslag.begin();
  } catch (fout) {
    return toonFout(fout);
  }
  tab = tabUitHash();
  // Zo werkt de terug-knop van de browser ook tussen de tabbladen.
  window.addEventListener('hashchange', () => {
    const nieuw = tabUitHash();
    if (nieuw !== tab) { tab = nieuw; teken(); }
  });
  teken();
  laadBenodigdeFotos();

  setInterval(() => {
    if (document.visibilityState === 'visible' && !storendMoment()) {
      opslag.ververs().then(laadBenodigdeFotos).catch(() => {});
    }
  }, 120000);
}

/** De beheerder ziet de hele bibliotheek, dus die heeft alle foto's nodig. */
function laadBenodigdeFotos() {
  fotos.laad(taakLijst(doc(), { inclusiefGearchiveerd: true }).map((t) => t.fotoId).filter(Boolean));
}

function tabUitHash() {
  const uit = location.hash.replace('#', '');
  return ['week', 'bibliotheek', 'historie', 'berichten'].includes(uit) ? uit : 'week';
}

function kiesTab(nieuw) {
  tab = nieuw;
  location.hash = nieuw;
  teken();
  naarBoven();
}

function toonFout(fout) {
  voegToe(leeg(scherm()), el('div', { class: 'leeg' }, [
    el('div', { class: 'groot', tekst: '⚠️' }),
    el('p', { tekst: fout.netwerk ? 'Geen verbinding met GitHub.' : fout.message }),
    el('div', { class: 'knoppenrij', stijl: { justifyContent: 'center' } }, [
      el('button', { class: 'knop primair', tekst: 'Opnieuw proberen', onclick: () => location.reload() }),
      el('button', {
        class: 'knop gevaar', tekst: 'Opnieuw inrichten',
        onclick: () => { vergeetToegang(); location.href = './index.html'; },
      }),
    ]),
  ]));
}

function teken() {
  if (!opslag?.geladen) return;
  behoudPlek(() => {
    for (const knop of $$('.tab')) knop.setAttribute('aria-selected', String(knop.dataset.tab === tab));
    werkBerichtenTelBij();
    if (tab === 'week') tekenWeek();
    else if (tab === 'bibliotheek') tekenBibliotheek();
    else if (tab === 'historie') tekenHistorie();
    else tekenBerichten();
  });
}

function werkBerichtenTelBij() {
  const knop = $$('.tab').find((k) => k.dataset.tab === 'berichten');
  knop.querySelector('.bolletje')?.remove();
  const n = aantalOngelezen(doc(), 'beheerder');
  if (n > 0) knop.append(el('span', { class: 'bolletje', tekst: String(n), title: 'ongelezen' }));
}

/* -------------------------------------------------- tabblad 1: weeklijst */

function tekenWeek() {
  const sam = weekSamensteller(doc(), week.jaar, week.weeknummer);
  const alle = sam.groepen.flatMap((g) => g.taken);
  const gekozen = alle.filter((t) => t.geselecteerd);
  const minuten = gekozen.reduce((som, t) => som + (t.geschatteMinuten || 0), 0);
  const nu = sam.navigatie.huidige;
  const isHuidige = sam.week.jaar === nu.jaar && sam.week.weeknummer === nu.weeknummer;
  const doel = leeg(scherm());

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-binnen' }, [
      el('div', { class: 'rij', stijl: { marginBottom: '10px' } }, [
        el('button', {
          class: 'knop klein', tekst: '← Vorige',
          onclick: () => { week = sam.navigatie.vorige; teken(); },
        }),
        el('div', { stijl: { flex: '1', textAlign: 'center', minWidth: '0' } }, [
          el('div', { stijl: { fontWeight: '650' }, tekst: `Week ${sam.week.weeknummer} · ${sam.week.jaar}` }),
          el('div', { class: 'klein stil', tekst: `vanaf ${langeDatum(sam.week.startdatum)}` }),
        ]),
        el('button', {
          class: 'knop klein', tekst: 'Volgende →',
          onclick: () => { week = sam.navigatie.volgende; teken(); },
        }),
      ]),
      !isHuidige ? el('div', { class: 'rij', stijl: { justifyContent: 'center' } }, [
        el('button', { class: 'knop klein stil', tekst: 'Naar deze week', onclick: () => { week = nu; teken(); } }),
      ]) : null,
    ]),
  ]));

  const notitieVeld = el('textarea', {
    id: 'weeknotitie', maxlength: '1000',
    placeholder: 'Bijvoorbeeld: deze week extra aandacht voor de vensterbanken.',
  });
  notitieVeld.value = sam.week.notitie;
  let timer = null;
  notitieVeld.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      opslag.doe(
        { soort: 'week.notitie', week: sam.week.sleutel, notitie: notitieVeld.value },
        { vervangSleutel: `notitie:${sam.week.sleutel}` },
      );
    }, 600);
  });

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Notitie voor deze week' })]),
    el('div', { class: 'kaart-binnen' }, [
      notitieVeld,
      el('p', { class: 'hulp', tekst: 'Verschijnt bovenaan bij de schoonmaakster. Wordt vanzelf opgeslagen.' }),
    ]),
  ]));

  const weekStand = haalWeek(doc(), sam.week.jaar, sam.week.weeknummer);
  const gewerkt = gewerkteMinuten(weekStand);
  const bezig = !!lopendBezoek(weekStand);

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-binnen' }, [
      el('div', { class: 'rij', stijl: { flexWrap: 'wrap', gap: '8px', marginBottom: '12px' } }, [
        el('span', { class: 'label accent', tekst: `${meervoud(gekozen.length, 'taak', 'taken')} gepland` }),
        minuten ? el('span', { class: 'label', tekst: `± ${Math.round(minuten / 5) * 5} minuten` }) : null,
        bezig
          ? el('span', {
            class: 'label waarschuwing',
            tekst: [wieIsBezig(weekStand), 'nu bezig', alsDuur(gewerkt)].filter(Boolean).join(' · '),
          })
          : gewerkt ? el('span', { class: 'label', tekst: `gewerkt: ${alsDuur(gewerkt)}` }) : null,
        el('span', { class: 'label stil', tekst: `${alle.length} taken in de bibliotheek` }),
      ]),
      el('div', { class: 'knoppenrij' }, [
        el('button', { class: 'knop klein', tekst: '↺ Kopieer vorige week', onclick: () => kopieerVorigeWeek(sam) }),
        el('button', { class: 'knop klein', tekst: '✓ Alles wekelijks aanzetten', onclick: () => zetWekelijks(sam, alle) }),
        el('button', { class: 'knop klein gevaar', tekst: 'Alles uit', onclick: () => zetSelectie(sam, []) }),
      ]),
    ]),
  ]));

  for (const groep of sam.groepen) {
    const aantal = groep.taken.filter((t) => t.geselecteerd).length;
    doel.append(
      el('div', { class: 'ruimte-kop' }, [
        el('h2', { tekst: groep.ruimteNaam }),
        el('span', { class: 'aantal', tekst: `${aantal}/${groep.taken.length}` }),
      ]),
      el('ul', { class: 'taaklijst' }, groep.taken.map((taak) => tekenSamenstellerTaak(sam, alle, taak))),
    );
  }

  if (!alle.length) {
    doel.append(el('div', { class: 'leeg' }, [
      el('p', { tekst: 'Er staan nog geen taken in de bibliotheek.' }),
      el('button', { class: 'knop primair', tekst: 'Naar de takenbibliotheek', onclick: () => kiesTab('bibliotheek') }),
    ]));
  }
}

function tekenSamenstellerTaak(sam, alle, taak) {
  const laat = taak.wekenGeleden === null || taak.wekenGeleden >= 4;
  const fotoUrl = taak.fotoId ? fotos.url(taak.fotoId) : null;

  const meta = el('span', { class: 'taak-meta' }, [
    el('span', {
      class: `label${taak.afgevinkt ? ' accent' : laat ? ' waarschuwing' : ''}`,
      tekst: taak.afgevinkt ? 'deze week gedaan' : wekenGeledenTekst(taak.wekenGeleden),
    }),
    el('span', { class: 'label stil', tekst: TAAKTYPE_LABEL[taak.type] }),
    taak.type === 'periodiek' ? el('span', { class: 'label stil', tekst: taak.standaardFrequentie }) : null,
    taak.geschatteMinuten ? el('span', { class: 'label stil', tekst: `${taak.geschatteMinuten} min` }) : null,
  ]);

  // Opruimtaken staan altijd op de lijst; die zijn niet aan of uit te zetten.
  const binnenkant = [
    el('span', { class: 'vink', 'aria-hidden': 'true' }, [vinkIcoon()]),
    el('span', { class: 'taak-midden' }, [
      el('span', { class: 'taak-titel', tekst: taak.titel }),
      meta,
    ]),
  ];

  return el('li', {
    class: `taak${taak.geselecteerd ? ' gekozen' : ''}${taak.vast ? ' vast' : ''}`,
    dataset: { taak: taak.id },
  }, [
    el('div', { class: 'taak-hoofd' }, [
      taak.vast
        ? el('div', { class: 'taak-rij', stijl: { cursor: 'default' }, title: 'Opruimtaken staan altijd op de weeklijst' }, binnenkant)
        : el('button', {
          class: 'taak-rij', type: 'button', 'aria-pressed': taak.geselecteerd ? 'true' : 'false',
          onclick: () => {
            const ids = alle.filter((t) => (t.id === taak.id ? !t.geselecteerd : t.geselecteerd)).map((t) => t.id);
            zetSelectie(sam, ids);
          },
        }, binnenkant),
      fotoUrl ? el('button', {
        class: 'foto-knop', type: 'button', 'aria-label': `Foto bij ${taak.titel}`,
        onclick: () => toonFoto(fotoUrl, taak.titel),
      }, [el('img', { class: 'duim', src: fotoUrl, alt: '' })]) : null,
    ]),
  ]);
}

function zetSelectie(sam, taakIds) {
  opslag.doe(
    { soort: 'week.taken', week: sam.week.sleutel, taakIds },
    { vervangSleutel: `weektaken:${sam.week.sleutel}` },
  );
}

function zetWekelijks(sam, alle) {
  const ids = new Set(alle.filter((t) => t.geselecteerd).map((t) => t.id));
  for (const taak of alle) if (taak.type === 'wekelijks') ids.add(taak.id);
  zetSelectie(sam, [...ids]);
}

function kopieerVorigeWeek(sam) {
  const ids = takenVanVorigeWeek(doc(), sam.week.jaar, sam.week.weeknummer);
  if (!ids.length) return meld('Vorige week stond niets ingepland.', 'fout', { duur: 4000 });
  zetSelectie(sam, ids);
  meld(`${meervoud(ids.length, 'taak', 'taken')} overgenomen`, 'goed');
}

/* ------------------------------------------------ tabblad 2: bibliotheek */

function tekenBibliotheek() {
  const ruimtes = ruimteLijst(doc(), { inclusiefGearchiveerd: true });
  const taken = taakLijst(doc(), { inclusiefGearchiveerd: true });
  const zichtbaar = taken.filter((t) => toonGearchiveerd || t.actief);
  const doel = leeg(scherm());

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-binnen' }, [
      el('div', { class: 'knoppenrij' }, [
        el('button', { class: 'knop primair', tekst: '+ Nieuwe taak', onclick: () => bewerkTaak(null) }),
        el('button', { class: 'knop', tekst: '⌂ Ruimtes', onclick: beheerRuimtes }),
        el('button', { class: 'knop', tekst: '👤 Schoonmaaksters', onclick: beheerSchoonmakers }),
        el('button', {
          class: 'knop stil klein',
          tekst: toonGearchiveerd ? 'Verberg gearchiveerd' : 'Toon gearchiveerd',
          onclick: () => { toonGearchiveerd = !toonGearchiveerd; teken(); },
        }),
      ]),
      el('p', {
        class: 'hulp',
        tekst: `${meervoud(taken.filter((t) => t.actief).length, 'actieve taak', 'actieve taken')} in ${meervoud(ruimtes.filter((r) => r.actief).length, 'ruimte', 'ruimtes')}.`,
      }),
    ]),
  ]));

  for (const ruimte of ruimtes) {
    const lijst = zichtbaar.filter((t) => t.ruimteId === ruimte.id);
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
  const fotoUrl = taak.fotoId ? fotos.url(taak.fotoId) : null;
  return el('li', { class: `taak${taak.actief ? '' : ' gearchiveerd'}`, dataset: { taak: taak.id } }, [
    el('div', { class: 'taak-hoofd' }, [
      el('button', { class: 'taak-rij', type: 'button', onclick: () => bewerkTaak(taak) }, [
        el('span', { class: 'taak-midden' }, [
          el('span', { class: 'taak-titel', tekst: taak.titel }),
          taak.omschrijving ? el('span', { class: 'taak-omschrijving', tekst: taak.omschrijving }) : null,
          el('span', { class: 'taak-meta' }, [
            el('span', { class: 'label', tekst: TAAKTYPE_LABEL[taak.type] }),
            taak.type === 'periodiek' ? el('span', { class: 'label stil', tekst: taak.standaardFrequentie }) : null,
            taak.geschatteMinuten ? el('span', { class: 'label stil', tekst: `${taak.geschatteMinuten} min` }) : null,
            !taak.actief ? el('span', { class: 'label waarschuwing', tekst: 'gearchiveerd' }) : null,
            !taak.fotoId ? el('span', { class: 'label stil', tekst: 'geen foto' }) : null,
          ]),
        ]),
      ]),
      fotoUrl ? el('button', {
        class: 'foto-knop', type: 'button', 'aria-label': `Foto bij ${taak.titel}`,
        onclick: () => toonFoto(fotoUrl, taak.titel),
      }, [el('img', { class: 'duim', src: fotoUrl, alt: '' })]) : null,
    ]),
    el('div', { class: 'taak-voet', stijl: { paddingLeft: '14px' } }, [
      el('button', {
        class: 'knop klein', tekst: '↑', 'aria-label': 'Omhoog', disabled: index === 0,
        onclick: () => verplaats(lijst, index, -1),
      }),
      el('button', {
        class: 'knop klein', tekst: '↓', 'aria-label': 'Omlaag', disabled: index === lijst.length - 1,
        onclick: () => verplaats(lijst, index, 1),
      }),
      el('button', { class: 'knop klein stil', tekst: 'Bewerken', onclick: () => bewerkTaak(taak) }),
      el('button', { class: 'knop klein stil', tekst: 'Historie', onclick: () => toonTaakHistorie(taak) }),
    ]),
  ]);
}

function verplaats(lijst, index, richting) {
  const doelIndex = index + richting;
  if (doelIndex < 0 || doelIndex >= lijst.length) return;
  const ids = lijst.map((t) => t.id);
  [ids[index], ids[doelIndex]] = [ids[doelIndex], ids[index]];
  opslag.doe({ soort: 'taak.volgorde', ids });
}

function bewerkTaak(taak) {
  const nieuw = !taak;
  const ruimtes = ruimteLijst(doc(), { inclusiefGearchiveerd: true });
  let fotoId = taak?.fotoId ?? null;

  const titelVeld = el('input', { type: 'text', maxlength: '120', placeholder: 'Bijv. Badkamer: douchewand' });
  titelVeld.value = taak?.titel || '';

  const ruimteVeld = el('select', {}, ruimtes
    .filter((r) => r.actief || r.id === taak?.ruimteId)
    .map((r) => el('option', { value: r.id, tekst: r.naam + (r.actief ? '' : ' (gearchiveerd)') })));
  ruimteVeld.value = taak?.ruimteId || ruimtes.find((r) => r.actief)?.id || '';

  const omschrijvingVeld = el('textarea', {
    maxlength: '2000',
    placeholder: 'Korte instructie in gewone taal. Noem het schoonmaakmiddel als dat uitmaakt.',
  });
  omschrijvingVeld.value = taak?.omschrijving || '';

  const typeVeld = el('select', {}, TAAKTYPES.map((t) => el('option', { value: t, tekst: TAAKTYPE_LABEL[t] })));
  typeVeld.value = taak?.type || 'wekelijks';

  const frequentieVeld = el('select', {}, FREQUENTIES.map((f) => el('option', { value: f, tekst: f })));
  frequentieVeld.value = taak?.standaardFrequentie || 'wekelijks';

  const typeUitleg = el('p', { class: 'hulp' });
  const frequentieVak = el('label', { class: 'veld' }, [
    el('span', { tekst: 'Hoe vaak ongeveer' }), frequentieVeld,
  ]);
  const werkTypeBij = () => {
    const gekozen = typeVeld.value;
    typeUitleg.textContent = {
      wekelijks: 'Staat standaard aan als je een week samenstelt.',
      periodiek: 'Zet je zelf aan als hij aan de beurt is. Je ziet erbij hoelang geleden het is gedaan.',
      indien_nodig: 'Staat altijd op haar lijst. Zij kiest zelf: was al in orde, of heb ik gedaan.',
    }[gekozen];
    frequentieVak.hidden = gekozen !== 'periodiek';
  };
  typeVeld.addEventListener('change', werkTypeBij);
  werkTypeBij();

  const minutenVeld = el('input', { type: 'number', min: '0', max: '480', step: '5', placeholder: 'bijv. 10' });
  minutenVeld.value = taak?.geschatteMinuten ?? '';

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
        const base64 = await alsBase64(blob);
        meld('Foto opslaan…', 'bezig');
        const id = fotoId || nieuwId('f');
        await fotos.bewaar(id, base64);
        fotoId = id;
        tekenFotoVak();
        meld(`Foto opgeslagen (${Math.round(blob.size / 1024)} kB)`, 'goed');
      } catch (fout) {
        meld(fout.message || 'Foto opslaan mislukt.', 'fout', { duur: 6000 });
      }
    },
  });

  function tekenFotoVak() {
    const url = fotoId ? fotos.url(fotoId) : null;
    voegToe(leeg(fotoVak),
      url
        ? el('div', { class: 'rij', stijl: { marginBottom: '8px' } }, [
          el('img', {
            src: url, alt: 'Voorbeeldfoto',
            stijl: { width: '86px', height: '86px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--rand)' },
            onclick: () => toonFoto(url, titelVeld.value),
          }),
          el('div', { class: 'knoppenrij' }, [
            el('button', { class: 'knop klein', type: 'button', tekst: 'Vervangen', onclick: () => bestandVeld.click() }),
            el('button', {
              class: 'knop klein gevaar', type: 'button', tekst: 'Verwijderen',
              onclick: () => { fotoId = null; tekenFotoVak(); },
            }),
          ]),
        ])
        : el('button', { class: 'knop', type: 'button', tekst: '📷 Foto kiezen', onclick: () => bestandVeld.click() }),
      el('p', { class: 'hulp', tekst: 'De foto wordt automatisch verkleind voordat hij wordt opgeslagen.' }),
    );
  }
  tekenFotoVak();

  const modaal = toonModaal({
    titel: nieuw ? 'Nieuwe taak' : 'Taak bewerken',
    inhoud: [
      el('label', { class: 'veld' }, [el('span', { tekst: 'Titel' }), titelVeld]),
      el('label', { class: 'veld' }, [el('span', { tekst: 'Ruimte' }), ruimteVeld]),
      el('label', { class: 'veld' }, [el('span', { tekst: 'Omschrijving' }), omschrijvingVeld]),
      el('label', { class: 'veld' }, [el('span', { tekst: 'Type' }), typeVeld, typeUitleg]),
      el('div', { class: 'velden-rij' }, [
        frequentieVak,
        el('label', { class: 'veld' }, [el('span', { tekst: 'Geschatte minuten' }), minutenVeld]),
      ]),
      el('label', { class: 'veld' }, [el('span', { tekst: 'Voorbeeldfoto' }), fotoVak]),
      bestandVeld,
      !nieuw ? el('div', { class: 'knoppenrij', stijl: { marginTop: '4px' } }, [
        el('button', {
          class: 'knop klein gevaar', type: 'button',
          tekst: taak.actief ? 'Archiveren' : 'Terugzetten uit archief',
          onclick: () => {
            opslag.doe({ soort: 'taak.bewerk', id: taak.id, velden: { actief: !taak.actief } });
            modaal.sluit();
          },
        }),
      ]) : null,
    ],
    knoppen: [
      { tekst: 'Annuleren', bij: () => modaal.sluit() },
      {
        tekst: 'Opslaan', primair: true,
        bij: () => {
          const titel = titelVeld.value.trim();
          if (!titel) {
            titelVeld.focus();
            return meld('Geef de taak een titel.', 'fout', { duur: 3000 });
          }
          const velden = {
            titel,
            ruimteId: ruimteVeld.value,
            omschrijving: omschrijvingVeld.value.trim(),
            type: typeVeld.value,
            standaardFrequentie: typeVeld.value === 'periodiek' ? frequentieVeld.value : 'wekelijks',
            geschatteMinuten: minutenVeld.value === '' ? null : Number(minutenVeld.value),
            fotoId,
          };
          if (nieuw) opslag.doe({ soort: 'taak.maak', taak: { id: nieuwId('t'), ...velden } });
          else opslag.doe({ soort: 'taak.bewerk', id: taak.id, velden });
          modaal.sluit();
        },
      },
    ],
  });
  setTimeout(() => titelVeld.focus(), 80);
}

function beheerSchoonmakers() {
  const lijst = el('div');

  function tekenLijst() {
    const d = doc();
    const allen = schoonmakerLijst(d, { inclusiefGearchiveerd: true });
    const standaard = standaardSchoonmaker(d);

    if (!allen.length) {
      voegToe(leeg(lijst), el('p', {
        class: 'stil',
        tekst: 'Nog niemand toegevoegd. Zolang er niemand in staat, hoeft zij bij het starten niets te kiezen.',
      }));
      return;
    }

    voegToe(leeg(lijst), ...allen.map((persoon, i) => {
      const naamVeld = el('input', { type: 'text', maxlength: '60', stijl: { flex: '1' } });
      naamVeld.value = persoon.naam;
      naamVeld.addEventListener('change', () => {
        const naam = naamVeld.value.trim();
        if (!naam || naam === persoon.naam) return;
        opslag.doe({ soort: 'schoonmaker.bewerk', id: persoon.id, velden: { naam } });
        tekenLijst();
      });

      const verschuif = (richting) => {
        const ids = allen.map((s) => s.id);
        const j = i + richting;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        opslag.doe({ soort: 'schoonmaker.volgorde', ids });
        tekenLijst();
      };

      const isStandaard = standaard?.id === persoon.id;
      return el('div', { stijl: { marginBottom: '12px' } }, [
        el('div', { class: 'rij', stijl: { flexWrap: 'wrap' } }, [
          naamVeld,
          el('button', { class: 'knop klein', tekst: '\u2191', 'aria-label': 'Omhoog', disabled: i === 0, onclick: () => verschuif(-1) }),
          el('button', { class: 'knop klein', tekst: '\u2193', 'aria-label': 'Omlaag', disabled: i === allen.length - 1, onclick: () => verschuif(1) }),
          el('button', {
            class: `knop klein${persoon.actief ? ' gevaar' : ''}`,
            tekst: persoon.actief ? 'Archiveren' : 'Terug',
            onclick: () => {
              opslag.doe({ soort: 'schoonmaker.bewerk', id: persoon.id, velden: { actief: !persoon.actief } });
              tekenLijst();
            },
          }),
        ]),
        persoon.actief
          ? el('div', { class: 'rij klein', stijl: { marginTop: '5px' } }, [
            isStandaard
              ? el('span', { class: 'label accent', tekst: '\u2605 standaard' })
              : el('button', {
                class: 'knop klein stil', tekst: 'Maak standaard',
                onclick: () => {
                  opslag.doe({ soort: 'instelling.zet', sleutel: 'standaardSchoonmaker', waarde: persoon.id });
                  tekenLijst();
                },
              }),
          ])
          : el('div', { class: 'hulp', tekst: 'gearchiveerd \u2014 staat niet meer in haar keuzelijst' }),
      ]);
    }));
  }

  const nieuwVeld = el('input', { type: 'text', maxlength: '60', placeholder: 'Naam' });
  tekenLijst();

  const modaal = toonModaal({
    titel: 'Schoonmaaksters',
    ondertitel: 'Staat er meer dan \u00e9\u00e9n, dan kiest zij bij het starten haar naam. De standaard staat dan alvast voor.',
    inhoud: [
      lijst,
      el('hr', { class: 'scheider' }),
      el('div', { class: 'rij' }, [
        nieuwVeld,
        el('button', {
          class: 'knop primair', type: 'button', tekst: 'Toevoegen',
          onclick: () => {
            const naam = nieuwVeld.value.trim();
            if (!naam) return;
            opslag.doe({ soort: 'schoonmaker.maak', id: nieuwId('s'), naam });
            nieuwVeld.value = '';
            tekenLijst();
          },
        }),
      ]),
    ],
    knoppen: [{ tekst: 'Klaar', primair: true, bij: () => { modaal.sluit(); teken(); } }],
  });
}

function beheerRuimtes() {
  const lijst = el('div');

  function tekenLijst() {
    const ruimtes = ruimteLijst(doc(), { inclusiefGearchiveerd: true });
    voegToe(leeg(lijst), ...ruimtes.map((ruimte, i) => {
      const naamVeld = el('input', { type: 'text', maxlength: '60', stijl: { flex: '1' } });
      naamVeld.value = ruimte.naam;
      naamVeld.addEventListener('change', () => {
        const naam = naamVeld.value.trim();
        if (!naam || naam === ruimte.naam) return;
        opslag.doe({ soort: 'ruimte.bewerk', id: ruimte.id, velden: { naam } });
        tekenLijst();
      });
      const verschuif = (richting) => {
        const ids = ruimtes.map((r) => r.id);
        const j = i + richting;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        opslag.doe({ soort: 'ruimte.volgorde', ids });
        tekenLijst();
      };
      return el('div', { class: 'rij', stijl: { marginBottom: '8px', flexWrap: 'wrap' } }, [
        naamVeld,
        el('button', { class: 'knop klein', tekst: '↑', 'aria-label': 'Omhoog', disabled: i === 0, onclick: () => verschuif(-1) }),
        el('button', { class: 'knop klein', tekst: '↓', 'aria-label': 'Omlaag', disabled: i === ruimtes.length - 1, onclick: () => verschuif(1) }),
        el('button', {
          class: `knop klein${ruimte.actief ? ' gevaar' : ''}`,
          tekst: ruimte.actief ? 'Archiveren' : 'Terug',
          onclick: () => {
            opslag.doe({ soort: 'ruimte.bewerk', id: ruimte.id, velden: { actief: !ruimte.actief } });
            tekenLijst();
          },
        }),
      ]);
    }));
  }

  const nieuwVeld = el('input', { type: 'text', maxlength: '60', placeholder: 'Naam van de ruimte' });
  tekenLijst();

  const modaal = toonModaal({
    titel: 'Ruimtes',
    inhoud: [
      lijst,
      el('hr', { class: 'scheider' }),
      el('div', { class: 'rij' }, [
        nieuwVeld,
        el('button', {
          class: 'knop primair', type: 'button', tekst: 'Toevoegen',
          onclick: () => {
            const naam = nieuwVeld.value.trim();
            if (!naam) return;
            opslag.doe({ soort: 'ruimte.maak', id: nieuwId('r'), naam });
            nieuwVeld.value = '';
            tekenLijst();
          },
        }),
      ]),
    ],
    knoppen: [{ tekst: 'Klaar', primair: true, bij: () => { modaal.sluit(); teken(); } }],
  });
}

/* --------------------------------------------------- tabblad 3: historie */

function tekenHistorie() {
  const weken = historie(doc(), 12);
  const nu = huidigeWeek();
  const doel = leeg(scherm());

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Laatste weken' })]),
    weken.length
      ? el('div', {}, weken.map((w) => tekenHistorieWeek(w, nu)))
      : el('div', { class: 'kaart-binnen' }, [el('p', { class: 'stil', tekst: 'Nog geen weken met taken.' })]),
  ]));

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Per taak' })]),
    el('div', { class: 'kaart-binnen' }, [
      el('p', { class: 'hulp', tekst: 'Tik op een taak om te zien wanneer die de afgelopen tijd gedaan is.' }),
      ...groepeerPerRuimte(taakLijst(doc()).map((t) => ({ ...t, ruimteId: t.ruimteId, ruimteNaam: t.ruimteNaam })))
        .map((groep) => el('div', { class: 'taakgroep' }, [
          el('h3', { class: 'taakgroep-kop', tekst: groep.ruimteNaam }),
          el('div', {}, groep.taken.map((taak) => el('button', {
            class: 'knop klein', stijl: { margin: '0 6px 6px 0' },
            tekst: taak.titel,
            onclick: () => toonTaakHistorie(taak),
          }))),
        ])),
    ]),
  ]));

  doel.append(tekenOpruimen());
  doel.append(el('p', { class: 'voetregel', id: 'versieregel' }));
  versieRegel().then((regel) => {
    const knoop = $('#versieregel');
    if (knoop) knoop.textContent = regel;
  });
}

/* Opruimen: de historie leegmaken na het uitproberen. */

function tekenOpruimen() {
  const omvang = historieOmvang(doc());
  return el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Opruimen' })]),
    el('div', { class: 'kaart-binnen' }, [
      el('p', { tekst: 'Heb je zitten proberen? Hiermee gooi je de hele historie weg en begin je met een schone lei.' }),
      el('p', { class: 'hulp', tekst: 'De takenbibliotheek, de ruimtes, de foto\'s en de schoonmaaksters blijven staan.' }),
      el('button', {
        class: 'knop gevaar', tekst: '🧹 Historie wissen',
        disabled: !omvang.aantalWeken && !omvang.aantalBerichten,
        onclick: () => vraagHistorieWissen(omvang),
      }),
    ]),
  ]);
}

function vraagHistorieWissen(omvang) {
  const regels = [
    [omvang.aantalWeken, 'week', 'weken'],
    [omvang.aantalAfgevinkt, 'afgevinkte taak', 'afgevinkte taken'],
    [omvang.aantalOpmerkingen, 'opmerking', 'opmerkingen'],
    [omvang.aantalBezoeken, 'geregistreerde werkbeurt', 'geregistreerde werkbeurten'],
    [omvang.aantalBerichten, 'bericht', 'berichten'],
  ].filter(([aantal]) => aantal > 0);

  const modaal = toonModaal({
    titel: 'Historie wissen?',
    ondertitel: 'Dit kun je niet terugdraaien.',
    inhoud: [
      el('p', { tekst: 'Weg gaat:' }),
      el('ul', { stijl: { margin: '0 0 14px', paddingLeft: '22px' } },
        regels.map(([aantal, enkel, meer]) => el('li', { tekst: meervoud(aantal, enkel, meer) }))),
      el('p', { class: 'hulp', tekst: 'Blijft staan: de takenbibliotheek, de ruimtes, de foto\'s en de schoonmaaksters.' }),
    ],
    knoppen: [
      { tekst: 'Annuleren', bij: () => modaal.sluit() },
      {
        tekst: 'Ja, wissen', primair: true,
        bij: () => {
          opslag.doe({ soort: 'historie.wis', weken: omvang.weken, berichten: omvang.berichten });
          modaal.sluit();
          meld('Historie gewist', 'goed');
        },
      },
    ],
  });
}

function tekenHistorieWeek(w, nu) {
  const percentage = w.gepland ? Math.round((w.afgevinkt / w.gepland) * 100) : 0;
  const isHuidige = w.jaar === nu.jaar && w.weeknummer === nu.weeknummer;
  const houder = el('div', { stijl: { borderTop: '1px solid var(--rand)' } });
  houder.append(el('button', {
    class: 'taak-rij', type: 'button', onclick: () => wisselWeekDetail(w, houder),
  }, [
    el('span', { class: 'taak-midden' }, [
      el('span', { class: 'taak-titel', tekst: `Week ${w.weeknummer}${isHuidige ? ' — deze week' : ''}` }),
      el('span', { class: 'klein stil', tekst: `vanaf ${langeDatum(w.startdatum)}` }),
      el('span', { class: 'taak-meta' }, [
        el('span', {
          class: `label${percentage === 100 ? ' accent' : percentage < 50 ? ' waarschuwing' : ''}`,
          tekst: `${w.afgevinkt} van ${w.gepland} gedaan`,
        }),
        w.gewerkteMinuten ? el('span', { class: 'label', tekst: `${alsDuur(w.gewerkteMinuten)} gewerkt` }) : null,
        w.notitie ? el('span', { class: 'label stil', tekst: '✎ notitie' }) : null,
      ]),
      el('span', { class: 'balk', stijl: { marginTop: '8px', display: 'block' } }, [
        el('span', { class: 'balk-vulling', stijl: { width: `${percentage}%`, display: 'block' } }),
      ]),
    ]),
  ]));
  return houder;
}

function wisselWeekDetail(w, houder) {
  const bestaand = houder.querySelector('.week-detail');
  if (bestaand) return bestaand.remove();
  const data = weekOverzicht(doc(), w.jaar, w.weeknummer);
  houder.append(el('div', { class: 'week-detail', stijl: { padding: '12px 14px' } }, [
    data.week.notitie ? el('div', { class: 'notitie' }, [
      el('div', { class: 'label', tekst: 'Notitie' }), el('p', { tekst: data.week.notitie }),
    ]) : null,
    data.bezoeken?.length ? el('div', { stijl: { marginBottom: '12px' } }, [
      el('div', { class: 'klein', stijl: { fontWeight: '650', marginBottom: '4px' }, tekst: 'Gewerkt' }),
      ...data.bezoeken.map((b) => el('div', { class: 'klein stil', tekst: beschrijfBezoek(b) })),
    ]) : null,
    ...data.groepen.map((groep) => el('div', { stijl: { marginBottom: '10px' } }, [
      el('div', { class: 'klein', stijl: { fontWeight: '650', marginBottom: '4px' }, tekst: groep.ruimteNaam }),
      ...groep.taken.map((taak) => el('div', { class: 'klein', stijl: { display: 'flex', gap: '8px', padding: '3px 0' } }, [
        el('span', { tekst: taak.afgevinkt ? '✅' : '⬜️' }),
        el('span', { stijl: { flex: '1' } }, [
          taak.titel,
          taak.resultaat ? el('span', { class: 'label stil', stijl: { marginLeft: '6px' }, tekst: RESULTAAT_LABEL[taak.resultaat] }) : null,
          taak.afgevinkt ? el('span', { class: 'stil', tekst: ` — ${tijdstempel(taak.afgevinktOp)}` }) : null,
          taak.opmerking ? el('div', { class: 'opmerking-weergave', stijl: { marginTop: '4px' }, tekst: taak.opmerking }) : null,
        ]),
      ])),
    ])),
  ]));
}

function wieIsBezig(weekStand) {
  const lopend = lopendBezoek(weekStand);
  return lopend ? schoonmakerNaam(doc(), lopend.schoonmakerId) : null;
}

/** "Anna · dinsdag 11 augustus 9:00 – 11:30 (2 uur 30)" */
function beschrijfBezoek(bezoek) {
  const start = new Date(bezoek.gestartOp);
  const klok = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const wie = schoonmakerNaam(doc(), bezoek.schoonmakerId);
  const wanneer = bezoek.gestoptOp
    ? `${langeDatum(start)} ${klok(start)} – ${klok(new Date(bezoek.gestoptOp))} `
      + `(${alsDuur(Math.round((new Date(bezoek.gestoptOp) - start) / 60000))})`
    : `${langeDatum(start)} vanaf ${klok(start)} — niet afgesloten`;
  return wie ? `${wie} · ${wanneer}` : wanneer;
}

function toonTaakHistorie(taak) {
  const regels = taakHistorie(doc(), taak.id);
  const gedaan = regels.filter((h) => h.afgevinkt);
  const telling = taak.type === 'indien_nodig' ? resultaatTelling(doc(), taak.id) : null;
  const modaal = toonModaal({
    titel: 'Historie van deze taak',
    inhoud: [
      el('h3', { tekst: taak.titel }),
      el('p', { class: 'stil klein', tekst: `${taak.ruimteNaam} · ${TAAKTYPE_LABEL[taak.type]}` }),
      el('p', {}, [el('span', {
        class: 'label accent',
        tekst: gedaan.length
          ? `Laatst gedaan: week ${gedaan[0].weeknummer} (${korteDatum(gedaan[0].startdatum)})`
          : 'Nog nooit afgevinkt',
      })]),
      telling ? el('div', { class: 'notitie' }, [
        el('div', { class: 'label', tekst: 'Hoe vaak was het nodig?' }),
        el('p', {
          tekst: telling.weken
            ? `In ${meervoud(telling.weken, 'week', 'weken')}: ${telling.was_al_gedaan}× al in orde, `
              + `${telling.zelf_gedaan}× door haar gedaan`
              + (telling.open ? `, ${telling.open}× niet beantwoord` : '.')
            : 'Deze taak heeft nog niet op een weeklijst gestaan.',
        }),
      ]) : null,
      el('hr', { class: 'scheider' }),
      regels.length
        ? el('div', {}, regels.map((h) => el('div', { class: 'rij klein', stijl: { padding: '5px 0', borderBottom: '1px solid var(--rand)' } }, [
          el('span', { tekst: h.afgevinkt ? '✅' : '⬜️' }),
          el('span', { stijl: { flex: '1' } }, [
            `Week ${h.weeknummer} · ${korteDatum(h.startdatum)}`,
            h.resultaat ? el('span', { class: 'label stil', stijl: { marginLeft: '6px' }, tekst: RESULTAAT_LABEL[h.resultaat] }) : null,
            h.afgevinkt && h.afgevinktOp ? el('span', { class: 'stil', tekst: ` — ${tijdstempel(h.afgevinktOp)}` }) : null,
            h.opmerking ? el('div', { class: 'opmerking-weergave', stijl: { marginTop: '4px' }, tekst: h.opmerking }) : null,
          ]),
        ])))
        : el('p', { class: 'stil', tekst: 'Deze taak is nog niet op een weeklijst gezet.' }),
    ],
    knoppen: [{ tekst: 'Sluiten', primair: true, bij: () => modaal.sluit() }],
  });
}

/* -------------------------------------------------- tabblad 4: berichten */

function tekenBerichten() {
  const d = doc();
  const berichten = d.berichten || [];
  const opmerkingen = alleOpmerkingen(d);
  const ongelezen = berichten.filter((b) => !b.gelezen && b.afzender === 'schoonmaakster');
  const doel = leeg(scherm());

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [
      el('h2', { tekst: 'Berichten' }),
      ongelezen.length ? el('button', {
        class: 'knop klein stil', tekst: 'Alles gelezen',
        onclick: () => opslag.doe({ soort: 'berichten.allesGelezen', afzender: 'schoonmaakster' }),
      }) : null,
    ]),
    el('div', { class: 'kaart-binnen' }, [
      el('button', { class: 'knop primair', tekst: '✉ Bericht sturen', onclick: berichtSturen }),
    ]),
    berichten.length
      ? el('div', {}, berichten.map(tekenBericht))
      : el('div', { class: 'kaart-binnen' }, [el('p', { class: 'stil', tekst: 'Nog geen berichten.' })]),
  ]));

  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Opmerkingen bij taken' })]),
    opmerkingen.length
      ? el('div', { class: 'kaart-binnen' }, opmerkingen.map((o) => el('div', { stijl: { marginBottom: '14px' } }, [
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
      bericht.week ? el('span', { class: 'label stil', tekst: `week ${Number(bericht.week.split('-')[1])}` }) : null,
      ongelezen ? el('span', { class: 'label waarschuwing duw', tekst: 'nieuw' }) : null,
    ]),
    el('div', { tekst: bericht.tekst, stijl: { whiteSpace: 'pre-wrap' } }),
    ongelezen ? el('button', {
      class: 'knop klein stil', stijl: { marginTop: '6px' }, tekst: 'Markeer als gelezen',
      onclick: () => opslag.doe({ soort: 'bericht.gelezen', id: bericht.id, gelezen: true }),
    }) : null,
  ]);
}

function berichtSturen() {
  const invoer = el('textarea', {
    maxlength: '2000', placeholder: 'Bijvoorbeeld: nieuwe allesreiniger staat onder de gootsteen.',
  });
  const modaal = toonModaal({
    titel: 'Bericht sturen',
    ondertitel: 'De schoonmaakster ziet dit onderaan haar weeklijst.',
    inhoud: [invoer],
    knoppen: [
      { tekst: 'Annuleren', bij: () => modaal.sluit() },
      {
        tekst: 'Versturen', primair: true,
        bij: () => {
          const tekst = invoer.value.trim();
          if (!tekst) return modaal.sluit();
          opslag.doe({
            soort: 'bericht.maak',
            bericht: {
              id: nieuwId('b'),
              week: weekSleutel(week.jaar, week.weeknummer),
              afzender: 'beheerder',
              tekst,
              aangemaaktOp: new Date().toISOString(),
              gelezen: false,
            },
          });
          modaal.sluit();
          meld('Bericht verstuurd', 'goed');
        },
      },
    ],
  });
  setTimeout(() => invoer.focus(), 80);
}

begin();
