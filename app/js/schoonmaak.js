/* Schoonmaakweergave: de weeklijst afvinken en opmerkingen achterlaten. */

import { haalToegang } from './config.js';
import { Opslag } from './opslag.js';
import { FotoOpslag } from './fotos.js';
import { volgOpslag } from './status.js';
import { toonFoto } from './fotoscherm.js';
import { toonModaal } from './modaal.js';
import { meld } from './melding.js';
import {
  weekOverzicht, weekSleutel, nieuwId, lopendBezoek, gewerkteMinuten, vergetenBezoeken, alsDuur,
  schoonmakerLijst, standaardSchoonmaker, schoonmakerNaam,
} from './document.js';
import { toonTestbalkIndienNodig } from './testbanner.js';
import { huidigeWeek } from './week.js';
import {
  el, leeg, voegToe, behoudPlek, $, weekTitel, tijdstempel, meervoud, vinkIcoon,
} from './util.js';

const toegang = haalToegang('schoonmaakster');
let opslag = null;
let fotos = null;
let nu = huidigeWeek();
let overzicht = null;

async function begin() {
  if (!toegang) return toonGeenToegang();

  toonTestbalkIndienNodig(toegang);
  if (toegang.test) {
    // Een testlink kan ook rechtstreeks geopend worden; dan is er nog niets gevuld.
    const { zorgVoorTestgegevens } = await import('./testdata.js');
    await zorgVoorTestgegevens();
  }
  opslag = new Opslag(toegang);
  fotos = new FotoOpslag(toegang);
  volgOpslag(opslag);

  opslag.addEventListener('verandering', teken);
  fotos.addEventListener('verandering', teken);

  try {
    await opslag.begin();
  } catch (fout) {
    return toonLaadfout(fout);
  }
  teken();
  laadBenodigdeFotos();

  // Af en toe kijken of de beheerder de lijst heeft aangepast.
  const ververs = () => {
    if (document.visibilityState !== 'visible') return;
    nu = huidigeWeek();
    opslag.ververs().then(laadBenodigdeFotos).catch(() => {});
  };
  document.addEventListener('visibilitychange', ververs);
  setInterval(ververs, 120000);
}

/** Alleen de foto's van deze week ophalen, en alleen als ze nog ontbreken. */
function laadBenodigdeFotos() {
  const nodig = (overzicht?.regels || []).map((r) => r.fotoId).filter(Boolean);
  fotos.laad(nodig);
}

function toonGeenToegang() {
  voegToe(leeg($('#lijst')), el('div', { class: 'leeg' }, [
    el('div', { class: 'groot', tekst: '🔒' }),
    el('h2', { tekst: 'Deze link werkt niet' }),
    el('p', { tekst: 'Open de link die je hebt gekregen helemaal, inclusief het stuk achter het hekje. Vraag anders om een nieuwe.' }),
  ]));
  $('#weektitel').textContent = 'Geen toegang';
  $('#bericht-knop').hidden = true;
}

function toonLaadfout(fout) {
  voegToe(leeg($('#lijst')), el('div', { class: 'leeg' }, [
    el('div', { class: 'groot', tekst: '📶' }),
    el('p', { tekst: fout.netwerk ? 'Geen verbinding, en op dit apparaat staat nog geen lijst.' : fout.message }),
    el('button', { class: 'knop primair', tekst: 'Opnieuw proberen', onclick: () => location.reload() }),
  ]));
}

/* ------------------------------------------------------------------ tekenen */

function teken() {
  if (!opslag?.geladen) return;
  behoudPlek(tekenNu);
}

function tekenNu() {
  overzicht = weekOverzicht(opslag.document(), nu.jaar, nu.weeknummer);
  const { week, groepen, voortgang } = overzicht;

  $('#weektitel').textContent = weekTitel(week);
  $('#weekonder').textContent = voortgang.totaal
    ? `${meervoud(voortgang.totaal, 'taak', 'taken')} deze week`
    : 'Nog geen taken ingepland';

  const notitie = leeg($('#notitie'));
  if (week.notitie) {
    notitie.append(el('div', { class: 'notitie' }, [
      el('div', { class: 'label', tekst: 'Bericht van thuis' }),
      el('p', { tekst: week.notitie }),
    ]));
  }

  tekenWerkblok();
  tekenVoortgang(voortgang);

  const lijst = leeg($('#lijst'));
  if (!groepen.length) {
    lijst.append(el('div', { class: 'leeg' }, [
      el('div', { class: 'groot', tekst: '🌿' }),
      el('p', { tekst: 'Er staan deze week nog geen taken klaar.' }),
      el('p', { class: 'klein', tekst: 'Kijk later nog eens, of laat hieronder een bericht achter.' }),
    ]));
  } else {
    for (const groep of groepen) {
      const gedaan = groep.taken.filter((t) => t.afgevinkt).length;
      lijst.append(
        el('div', { class: 'ruimte-kop' }, [
          el('h2', { tekst: groep.ruimteNaam }),
          el('span', { class: 'aantal', tekst: `${gedaan}/${groep.taken.length}` }),
        ]),
        el('ul', { class: 'taaklijst' }, groep.taken.map(tekenTaak)),
      );
    }
  }

  tekenKlaarMelding(voortgang);
  tekenBerichten();
}

/* --------------------------------------------------------- starten en klaar */

let klokTimer = null;

function tekenWerkblok() {
  const doel = leeg($('#werk'));
  const week = overzicht.week;
  const lopend = lopendBezoek(week);
  const vergeten = vergetenBezoeken(week);
  const minuten = gewerkteMinuten(week);

  clearInterval(klokTimer);

  if (lopend) {
    const sinds = new Date(lopend.gestartOp);
    const klok = el('div', { class: 'klok', tekst: minuten < 1 ? 'net begonnen' : alsDuur(minuten) });
    const wie = schoonmakerNaam(opslag.document(), lopend.schoonmakerId);
    doel.append(el('div', { class: 'werkblok bezig' }, [
      klok,
      el('div', {
        class: 'sinds',
        tekst: [wie, `bezig sinds ${sinds.getHours()}:${String(sinds.getMinutes()).padStart(2, '0')}`]
          .filter(Boolean).join(' · '),
      }),
      el('button', { class: 'knop primair vol', type: 'button', tekst: '✓ Ik ben klaar', onclick: meldKlaar }),
    ]));
    // De klok loopt door zolang deze weergave in beeld is.
    klokTimer = setInterval(() => {
      const gelopen = gewerkteMinuten(overzicht.week);
      klok.textContent = gelopen < 1 ? 'net begonnen' : alsDuur(gelopen);
    }, 20000);
    return;
  }

  // Of ze al gewerkt heeft, hangt af van afgeronde bezoeken — niet van de
  // opgetelde minuten. Anders zou een korte beurt spoorloos verdwijnen.
  const afgerond = (week.bezoeken || []).filter((b) => b.gestoptOp);

  doel.append(el('div', { class: 'werkblok' }, [
    afgerond.length
      ? el('div', { class: 'klok', tekst: alsDuur(minuten) })
      : null,
    el('div', {
      class: 'sinds',
      tekst: afgerond.length
        ? `gewerkt deze week${afgerond.length > 1 ? ` · ${afgerond.length} keer` : ''}`
        : 'Tik hier als je begint, dan loopt de tijd mee.',
    }),
    el('button', {
      class: `knop ${afgerond.length ? '' : 'primair '}vol`.trim(),
      type: 'button',
      tekst: afgerond.length ? '▶ Opnieuw beginnen' : '▶ Ik begin',
      onclick: startWerk,
    }),
    vergeten.length
      ? el('p', { class: 'hulp', tekst: 'Een eerdere keer is niet afgesloten. Die tijd is niet meegeteld.' })
      : null,
  ]));
}

const WIE_SLEUTEL = `schoonmaak.wie.${toegang?.dataGist || 'test'}`;

function laatstGekozen() {
  try {
    return localStorage.getItem(WIE_SLEUTEL);
  } catch {
    return null;
  }
}

function onthoudKeuze(id) {
  try {
    if (id) localStorage.setItem(WIE_SLEUTEL, id);
  } catch { /* privémodus: dan alleen deze keer */ }
}

function startWerk() {
  const d = opslag.document();
  const mensen = schoonmakerLijst(d);
  // Niemand of maar één: dan valt er niets te kiezen.
  if (mensen.length <= 1) return beginBezoek(mensen[0]?.id ?? null);
  kiesWie(d, mensen);
}

function beginBezoek(schoonmakerId) {
  if (navigator.vibrate) navigator.vibrate(15);
  onthoudKeuze(schoonmakerId);
  opslag.doe({
    soort: 'bezoek.start',
    week: huidigeWeekSleutel(),
    id: nieuwId('bz'),
    tijd: new Date().toISOString(),
    schoonmakerId,
  });
}

/** Wie begint er? Haar laatste keuze op dit toestel staat voor. */
function kiesWie(d, mensen) {
  const vorige = laatstGekozen();
  const voorgesteld = mensen.find((p) => p.id === vorige)?.id || standaardSchoonmaker(d)?.id || mensen[0].id;

  const modaal = toonModaal({
    titel: 'Wie begint er?',
    inhoud: [
      el('div', { class: 'wie-lijst' }, mensen.map((persoon) => el('button', {
        class: `knop vol${persoon.id === voorgesteld ? ' primair' : ''}`,
        type: 'button',
        tekst: persoon.naam,
        onclick: () => { beginBezoek(persoon.id); modaal.sluit(); },
      }))),
    ],
    knoppen: [{ tekst: 'Annuleren', bij: () => modaal.sluit() }],
  });
}

function meldKlaar() {
  const week = overzicht.week;
  const lopend = lopendBezoek(week);
  if (!lopend) return;
  const { gedaan, totaal } = overzicht.voortgang;
  const minuten = gewerkteMinuten(week);
  const alles = totaal > 0 && gedaan === totaal;

  const modaal = toonModaal({
    titel: 'Klaar voor vandaag?',
    inhoud: [
      el('div', { stijl: { textAlign: 'center', padding: '4px 0 12px' } }, [
        el('div', { class: 'klok', tekst: alsDuur(minuten) }),
        el('div', { class: 'stil klein', tekst: 'gewerkt' }),
      ]),
      el('p', {
        tekst: totaal
          ? `Je hebt ${gedaan} van de ${totaal} taken afgevinkt.`
          : 'Er stonden deze week geen taken op de lijst.',
      }),
      !alles && totaal
        ? el('p', { class: 'hulp', tekst: 'Niet alles hoeft af — wat blijft staan, ziet de beheerder gewoon terug.' })
        : null,
    ],
    knoppen: [
      { tekst: 'Nog niet', bij: () => modaal.sluit() },
      {
        tekst: 'Ja, ik ben klaar', primair: true,
        bij: () => {
          opslag.doe({
            soort: 'bezoek.stop',
            week: huidigeWeekSleutel(),
            id: lopend.id,
            tijd: new Date().toISOString(),
          });
          if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
          meld('Bedankt! Tijd genoteerd.', 'goed', { duur: 3000 });
          modaal.sluit();
        },
      },
    ],
  });
}

function tekenVoortgang({ gedaan, totaal }) {
  const doel = leeg($('#voortgang'));
  if (!totaal) return;
  const percentage = Math.round((gedaan / totaal) * 100);
  doel.append(
    el('div', { class: 'voortgang-tekst' }, [
      el('span', {}, [el('strong', { tekst: `${gedaan} van de ${totaal}` }), ' taken gedaan']),
      el('span', { tekst: `${percentage}%` }),
    ]),
    el('div', {
      class: 'balk', role: 'progressbar',
      'aria-valuenow': gedaan, 'aria-valuemin': 0, 'aria-valuemax': totaal,
      'aria-label': `${gedaan} van de ${totaal} taken gedaan`,
    }, [
      el('div', { class: `balk-vulling${gedaan === totaal ? ' klaar' : ''}`, stijl: { width: `${percentage}%` } }),
    ]),
  );
}

// Wat de knoppen bij een opruimtaak zeggen, vanuit haar gezien.
const KEUZE = {
  was_al_gedaan: { knop: 'Was al in orde', gekozen: 'Was al in orde' },
  zelf_gedaan: { knop: 'Heb ik gedaan', gekozen: 'Door jou gedaan' },
};

function tekenTaak(taak) {
  if (taak.type === 'indien_nodig') return tekenOpruimtaak(taak);

  const rij = el('button', {
    class: 'taak-rij', type: 'button', 'aria-pressed': taak.afgevinkt ? 'true' : 'false',
    onclick: () => wisselAfvinken(taak),
  }, [
    el('span', { class: 'vink', 'aria-hidden': 'true' }, [vinkIcoon()]),
    el('span', { class: 'taak-midden' }, [
      el('span', { class: 'taak-titel', tekst: taak.titel }),
      taak.omschrijving ? el('span', { class: 'taak-omschrijving', tekst: taak.omschrijving }) : null,
      taak.afgevinkt && taak.afgevinktOp
        ? el('span', { class: 'taak-meta' }, [
          el('span', { class: 'label accent', tekst: `Gedaan ${tijdstempel(taak.afgevinktOp)}` }),
        ])
        : null,
    ]),
  ]);

  const fotoUrl = taak.fotoId ? fotos.url(taak.fotoId) : null;
  const fotoKnop = fotoUrl ? el('button', {
    class: 'foto-knop', type: 'button', 'aria-label': `Voorbeeldfoto bekijken bij ${taak.titel}`,
    onclick: () => toonFoto(fotoUrl, taak.titel),
  }, [el('img', { class: 'duim', src: fotoUrl, alt: '', decoding: 'async' })]) : null;

  const voet = el('div', { class: 'taak-voet' }, [
    taak.opmerking ? el('div', { class: 'opmerking-weergave', tekst: taak.opmerking }) : null,
    el('button', {
      class: 'knop klein stil', type: 'button',
      tekst: taak.opmerking ? 'Opmerking aanpassen' : '✎ Opmerking',
      onclick: () => opmerkingBewerken(taak),
    }),
  ]);

  return el('li', { class: `taak${taak.afgevinkt ? ' gedaan' : ''}`, dataset: { taak: taak.taakId } }, [
    el('div', { class: 'taak-hoofd' }, [rij, fotoKnop]),
    voet,
  ]);
}

/**
 * Opruimtaken werken anders: zij beoordeelt zelf of het nodig was. Twee knoppen
 * in plaats van een vinkje, zodat het verschil bewaard blijft.
 */
function tekenOpruimtaak(taak) {
  const fotoUrl = taak.fotoId ? fotos.url(taak.fotoId) : null;
  const gekozen = taak.resultaat;

  const kop = el('div', { class: 'taak-hoofd' }, [
    el('div', { class: 'taak-rij', stijl: { cursor: 'default' } }, [
      el('span', { class: `vink${gekozen ? '' : ' vraag'}`, 'aria-hidden': 'true' },
        gekozen ? [vinkIcoon()] : [el('span', { tekst: '?' })]),
      el('span', { class: 'taak-midden' }, [
        el('span', { class: 'taak-titel', tekst: taak.titel }),
        taak.omschrijving ? el('span', { class: 'taak-omschrijving', tekst: taak.omschrijving }) : null,
        gekozen
          ? el('span', { class: 'taak-meta' }, [
            el('span', { class: 'label accent', tekst: KEUZE[gekozen].gekozen }),
            taak.afgevinktOp ? el('span', { class: 'label stil', tekst: tijdstempel(taak.afgevinktOp) }) : null,
          ])
          : el('span', { class: 'taak-meta' }, [
            el('span', { class: 'label', tekst: 'kijk zelf of het nodig is' }),
          ]),
      ]),
    ]),
    fotoUrl ? el('button', {
      class: 'foto-knop', type: 'button', 'aria-label': `Voorbeeldfoto bekijken bij ${taak.titel}`,
      onclick: () => toonFoto(fotoUrl, taak.titel),
    }, [el('img', { class: 'duim', src: fotoUrl, alt: '', decoding: 'async' })]) : null,
  ]);

  const keuze = gekozen
    ? el('div', { class: 'taak-keuze' }, [
      el('button', {
        class: 'knop klein stil', type: 'button', tekst: '↩ Toch anders',
        onclick: () => kiesResultaat(taak, null),
      }),
    ])
    : el('div', { class: 'taak-keuze' }, ['was_al_gedaan', 'zelf_gedaan'].map((soort) => el('button', {
      class: 'knop', type: 'button', tekst: KEUZE[soort].knop,
      onclick: () => kiesResultaat(taak, soort),
    })));

  return el('li', { class: `taak${gekozen ? ' gedaan' : ''}`, dataset: { taak: taak.taakId } }, [
    kop,
    keuze,
    el('div', { class: 'taak-voet' }, [
      taak.opmerking ? el('div', { class: 'opmerking-weergave', tekst: taak.opmerking }) : null,
      el('button', {
        class: 'knop klein stil', type: 'button',
        tekst: taak.opmerking ? 'Opmerking aanpassen' : '✎ Opmerking',
        onclick: () => opmerkingBewerken(taak),
      }),
    ]),
  ]);
}

function kiesResultaat(taak, resultaat) {
  if (navigator.vibrate) navigator.vibrate(resultaat ? 12 : 6);
  opslag.doe({
    soort: 'weektaak.resultaat',
    week: huidigeWeekSleutel(),
    taakId: taak.taakId,
    resultaat,
    tijd: new Date().toISOString(),
  }, { vervangSleutel: `resultaat:${taak.taakId}` });
}

function tekenKlaarMelding({ gedaan, totaal }) {
  const doel = leeg($('#klaar'));
  if (totaal > 0 && gedaan === totaal) {
    doel.append(el('div', { class: 'klaar-melding' }, [
      el('div', { class: 'groot', tekst: '✨' }),
      el('h2', { tekst: 'Alles gedaan!' }),
      el('p', { tekst: 'Alle taken van deze week staan afgevinkt. Bedankt!' }),
    ]));
  }
}

function tekenBerichten() {
  const doel = leeg($('#berichten'));
  if (!overzicht.berichten.length) return;
  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Berichten deze week' })]),
    el('div', { class: 'kaart-binnen' }, overzicht.berichten.map((b) => el('div', { stijl: { marginBottom: '12px' } }, [
      el('div', { class: 'klein stil', tekst: `${b.afzender === 'beheerder' ? 'Van thuis' : 'Van jou'} — ${tijdstempel(b.aangemaaktOp)}` }),
      el('div', { tekst: b.tekst, stijl: { whiteSpace: 'pre-wrap' } }),
    ]))),
  ]));
}

/* ------------------------------------------------------------------- acties */

function huidigeWeekSleutel() {
  return weekSleutel(nu.jaar, nu.weeknummer);
}

function wisselAfvinken(taak) {
  const aan = !taak.afgevinkt;
  if (navigator.vibrate) navigator.vibrate(aan ? 12 : 6);
  opslag.doe({
    soort: 'weektaak.afvinken',
    week: huidigeWeekSleutel(),
    taakId: taak.taakId,
    afgevinkt: aan,
    tijd: new Date().toISOString(),
  }, { vervangSleutel: `afvink:${taak.taakId}` });
}

function opmerkingBewerken(taak) {
  const invoer = el('textarea', {
    placeholder: 'Bijvoorbeeld: de vlek in de hoek gaat er niet uit.', maxlength: '2000',
  });
  invoer.value = taak.opmerking || '';
  const modaal = toonModaal({
    titel: 'Opmerking',
    ondertitel: taak.titel,
    inhoud: [invoer],
    knoppen: [
      { tekst: 'Annuleren', bij: () => modaal.sluit() },
      {
        tekst: 'Opslaan', primair: true,
        bij: () => {
          opslag.doe({
            soort: 'weektaak.opmerking',
            week: huidigeWeekSleutel(),
            taakId: taak.taakId,
            opmerking: invoer.value.trim(),
          }, { vervangSleutel: `opmerking:${taak.taakId}` });
          modaal.sluit();
        },
      },
    ],
  });
  setTimeout(() => invoer.focus(), 80);
}

function berichtAchterlaten() {
  const invoer = el('textarea', {
    placeholder: 'Bijvoorbeeld: de stofzuiger is stuk, of de allesreiniger is bijna op.', maxlength: '2000',
  });
  const modaal = toonModaal({
    titel: 'Bericht achterlaten',
    ondertitel: 'Voor algemene dingen die niet bij één taak horen.',
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
              week: huidigeWeekSleutel(),
              afzender: 'schoonmaakster',
              tekst,
              aangemaaktOp: new Date().toISOString(),
              gelezen: false,
            },
          });
          meld('Bericht verstuurd', 'goed');
          modaal.sluit();
        },
      },
    ],
  });
  setTimeout(() => invoer.focus(), 80);
}

$('#bericht-knop').addEventListener('click', berichtAchterlaten);
begin();
