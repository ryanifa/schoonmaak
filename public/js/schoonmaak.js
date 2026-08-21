/* Schoonmaakweergave: de weeklijst afvinken en opmerkingen achterlaten. */
import { api, wachtrij } from './api.js';
import { zorgVoorToegang } from './pin.js';
import { toonFoto } from './fotoscherm.js';
import { meld } from './melding.js';
import {
  el, leeg, $, weekTitel, tijdstempel, meervoud, vinkIcoon,
} from './util.js';

let staat = { week: null, groepen: [], voortgang: { gedaan: 0, totaal: 0 }, berichten: [] };
let huidig = null;

async function begin() {
  try {
    const start = await zorgVoorToegang();
    huidig = start.huidigeWeek;
    await laadWeek();
    wachtrij.verwerk();
  } catch (fout) {
    toonLaadfout(fout);
  }
  // Af en toe bijwerken, zodat een aanpassing van de weeklijst vanzelf verschijnt.
  const ververs = () => {
    const bezig = wachtrij.items.length || document.querySelector('.overlay');
    if (document.visibilityState === 'visible' && !bezig) laadWeek({ stil: true });
  };
  document.addEventListener('visibilitychange', ververs);
  setInterval(ververs, 120000);
}

async function laadWeek({ stil = false } = {}) {
  try {
    const data = await api.haal(`/api/week/${huidig.jaar}/${huidig.weeknummer}`);
    staat = data;
    teken();
  } catch (fout) {
    if (!stil) toonLaadfout(fout);
  }
}

function toonLaadfout(fout) {
  const lijst = $('#lijst');
  leeg(lijst).append(el('div', { class: 'leeg' }, [
    el('div', { class: 'groot', tekst: '📶' }),
    el('p', { tekst: fout.netwerk ? 'Geen verbinding met de app.' : fout.message }),
    el('button', { class: 'knop primair', tekst: 'Opnieuw proberen', onclick: () => laadWeek() }),
  ]));
}

/* ------------------------------------------------------------------ tekenen */

function teken() {
  const { week, groepen, voortgang } = staat;

  $('#weektitel').textContent = weekTitel(week);
  $('#weekonder').textContent = voortgang.totaal
    ? `${meervoud(voortgang.totaal, 'taak', 'taken')} deze week`
    : 'Nog geen taken ingepland';

  // Notitie van de beheerder
  const notitie = leeg($('#notitie'));
  if (week.notitie) {
    notitie.append(el('div', { class: 'notitie' }, [
      el('div', { class: 'label', tekst: 'Bericht van thuis' }),
      el('p', { tekst: week.notitie }),
    ]));
  }

  tekenVoortgang();

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

  tekenKlaarMelding();
  tekenBerichten();
}

function tekenVoortgang() {
  const { gedaan, totaal } = staat.voortgang;
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

function tekenTaak(taak) {
  const rij = el('button', {
    class: 'taak-rij', type: 'button',
    'aria-pressed': taak.afgevinkt ? 'true' : 'false',
    onclick: () => wisselAfvinken(taak),
  }, [
    el('span', { class: 'vink', 'aria-hidden': 'true' }, [vinkIcoon()]),
    el('span', { class: 'taak-midden' }, [
      el('span', { class: 'taak-titel', tekst: taak.titel }),
      taak.omschrijving ? el('span', { class: 'taak-omschrijving', tekst: taak.omschrijving }) : null,
      taak.afgevinkt && taak.afgevinktOp
        ? el('span', { class: 'taak-meta' }, [el('span', { class: 'label accent', tekst: `Gedaan ${tijdstempel(taak.afgevinktOp)}` })])
        : null,
    ]),
  ]);

  const voet = el('div', { class: 'taak-voet' }, [
    taak.opmerking ? el('div', { class: 'opmerking-weergave', tekst: taak.opmerking }) : null,
    el('button', {
      class: 'knop klein stil', type: 'button',
      tekst: taak.opmerking ? 'Opmerking aanpassen' : '✎ Opmerking',
      onclick: () => opmerkingBewerken(taak),
    }),
  ]);

  // De foto krijgt een eigen knop, zodat erop tikken de taak niet afvinkt.
  const fotoKnop = taak.fotoId ? el('button', {
    class: 'foto-knop', type: 'button',
    'aria-label': `Voorbeeldfoto bekijken bij ${taak.titel}`,
    onclick: () => toonFoto(api.fotoUrl(taak.fotoId), taak.titel),
  }, [
    el('img', {
      class: 'duim', src: api.fotoUrl(taak.fotoId), alt: '',
      loading: 'lazy', decoding: 'async',
    }),
  ]) : null;

  return el('li', { class: `taak${taak.afgevinkt ? ' gedaan' : ''}`, dataset: { id: taak.id } }, [
    el('div', { class: 'taak-hoofd' }, [rij, fotoKnop]),
    voet,
  ]);
}

function tekenKlaarMelding() {
  const doel = leeg($('#klaar'));
  const { gedaan, totaal } = staat.voortgang;
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
  const mijne = staat.berichten;
  if (!mijne.length) return;
  doel.append(el('div', { class: 'kaart' }, [
    el('div', { class: 'kaart-kop' }, [el('h2', { tekst: 'Berichten deze week' })]),
    el('div', { class: 'kaart-binnen' }, mijne.map((b) => el('div', { stijl: { marginBottom: '12px' } }, [
      el('div', { class: 'klein stil', tekst: `${b.afzender === 'beheerder' ? 'Van thuis' : 'Van jou'} — ${tijdstempel(b.aangemaaktOp)}` }),
      el('div', { tekst: b.tekst, stijl: { whiteSpace: 'pre-wrap' } }),
    ]))),
  ]));
}

/* ------------------------------------------------------------------- acties */

function wisselAfvinken(taak) {
  const nieuw = !taak.afgevinkt;
  taak.afgevinkt = nieuw;
  taak.afgevinktOp = nieuw ? new Date().toISOString() : null;
  const alle = staat.groepen.flatMap((g) => g.taken);
  staat.voortgang = { gedaan: alle.filter((t) => t.afgevinkt).length, totaal: alle.length };

  if (navigator.vibrate) navigator.vibrate(nieuw ? 12 : 6);
  teken();

  wachtrij.voegToe({
    sleutel: `afvinken:${taak.id}`,
    methode: 'POST',
    pad: `/api/weektaken/${taak.id}/afvinken`,
    body: { afgevinkt: nieuw },
  });
}

function opmerkingBewerken(taak) {
  const invoer = el('textarea', {
    placeholder: 'Bijvoorbeeld: de vlek in de hoek gaat er niet uit.',
    maxlength: '2000',
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
          taak.opmerking = invoer.value.trim();
          teken();
          wachtrij.voegToe({
            sleutel: `opmerking:${taak.id}`,
            methode: 'PUT',
            pad: `/api/weektaken/${taak.id}/opmerking`,
            body: { opmerking: taak.opmerking },
          });
          modaal.sluit();
        },
      },
    ],
  });
  setTimeout(() => invoer.focus(), 80);
}

function berichtAchterlaten() {
  const invoer = el('textarea', {
    placeholder: 'Bijvoorbeeld: de stofzuiger is stuk, of de allesreiniger is bijna op.',
    maxlength: '2000',
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
          const clientId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          staat.berichten.unshift({
            id: clientId, afzender: 'schoonmaakster', tekst, aangemaaktOp: new Date().toISOString(),
          });
          tekenBerichten();
          wachtrij.voegToe({
            sleutel: `bericht:${clientId}`,
            methode: 'POST',
            pad: '/api/berichten',
            body: { tekst, clientId, weekId: staat.week.id },
          });
          meld('Bericht verstuurd', 'goed');
          modaal.sluit();
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
      ...inhoud,
    ]),
    el('div', { class: 'modaal-voet' }, knoppen.map((k) => el('button', {
      class: `knop${k.primair ? ' primair' : ''}`, type: 'button', tekst: k.tekst, onclick: k.bij,
    }))),
  ]));
  document.body.append(overlay);
  return { sluit, overlay };
}

$('#bericht-knop').addEventListener('click', berichtAchterlaten);
begin();
