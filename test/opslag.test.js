import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NepGitHub, nepLocalStorage } from './nep-gist.js';

globalThis.localStorage = nepLocalStorage();

const { Opslag, documentNaarBestanden, bestandenNaarDocument } = await import('../app/js/opslag.js');
const { maakVoorbeeldDocument } = await import('../app/js/seed.js');
const { weekOverzicht, weekSleutel, nieuwId } = await import('../app/js/document.js');

let github;
let basisDoc;

function nieuweOpslag(rol = 'beheerder') {
  return new Opslag({ sleutel: 'goede-sleutel', dataGist: 'gist1', rol });
}

beforeEach(() => {
  localStorage.clear();
  github = new NepGitHub();
  basisDoc = maakVoorbeeldDocument();
  github.maakGist('gist1', documentNaarBestanden(basisDoc));
  github.installeer();
});

test('laden geeft de bibliotheek terug zoals hij in de Gist staat', async () => {
  const opslag = nieuweOpslag();
  const doc = await opslag.begin();
  assert.equal(doc.taken.length, basisDoc.taken.length);
  assert.equal(doc.ruimtes.length, basisDoc.ruimtes.length);
  assert.equal(doc.taken[0].titel, basisDoc.taken[0].titel);
});

test('een bewerking is meteen zichtbaar en wordt daarna pas verstuurd', async () => {
  const opslag = nieuweOpslag();
  await opslag.begin();
  const taakId = opslag.document().taken[0].id;

  opslag.doe({ soort: 'taak.bewerk', id: taakId, velden: { titel: 'Nieuwe titel' } });
  assert.equal(opslag.document().taken[0].titel, 'Nieuwe titel', 'meteen zichtbaar');
  assert.equal(opslag.wachtrij.length, 1, 'staat in de wachtrij');
  assert.equal(github.tellers.patch, 0, 'nog niets verstuurd');

  await opslag.verstuur();
  assert.equal(github.tellers.patch, 1);
  assert.equal(opslag.wachtrij.length, 0);

  const opnieuw = nieuweOpslag();
  assert.equal((await opnieuw.begin()).taken[0].titel, 'Nieuwe titel', 'ook echt in de Gist beland');
});

test('gelijktijdig werken op telefoon en laptop gaat niet verloren', async () => {
  const telefoon = nieuweOpslag('schoonmaakster');
  const laptop = nieuweOpslag('beheerder');
  await telefoon.begin();
  await laptop.begin();

  const week = weekSleutel(2026, 34);
  const taken = laptop.document().taken.slice(0, 3).map((t) => t.id);

  // De beheerder zet de weeklijst klaar en verstuurt.
  laptop.doe({ soort: 'week.taken', week, taakIds: taken });
  await laptop.verstuur();

  // De telefoon weet daar nog niets van; die haalt eerst op.
  await telefoon.ververs({ geforceerd: true });
  telefoon.doe({ soort: 'weektaak.afvinken', week, taakId: taken[0], afgevinkt: true, tijd: '2026-08-21T09:00:00Z' });

  // Ondertussen past de laptop de notitie aan en verstuurt die.
  laptop.doe({ soort: 'week.notitie', week, notitie: 'Let op de vensterbanken' });
  await laptop.verstuur();

  // Pas daarna komt de telefoon erdoorheen.
  await telefoon.verstuur();

  const controle = nieuweOpslag();
  const doc = await controle.begin();
  const overzicht = weekOverzicht(doc, 2026, 34);
  assert.equal(overzicht.week.notitie, 'Let op de vensterbanken', 'notitie van de laptop bewaard');
  assert.equal(overzicht.voortgang.gedaan, 1, 'afvinkje van de telefoon bewaard');
  assert.equal(overzicht.voortgang.totaal, 3);
});

test('twee afvinkjes tegelijk overschrijven elkaar niet', async () => {
  const a = nieuweOpslag('schoonmaakster');
  const b = nieuweOpslag('beheerder');
  await a.begin();
  await b.begin();

  const week = weekSleutel(2026, 34);
  const taken = a.document().taken.slice(0, 4).map((t) => t.id);
  b.doe({ soort: 'week.taken', week, taakIds: taken });
  await b.verstuur();
  await a.ververs({ geforceerd: true });

  a.doe({ soort: 'weektaak.afvinken', week, taakId: taken[0], afgevinkt: true, tijd: 't1' });
  b.doe({ soort: 'weektaak.afvinken', week, taakId: taken[1], afgevinkt: true, tijd: 't2' });
  await Promise.all([a.verstuur(), b.verstuur()]);

  const doc = await nieuweOpslag().begin();
  const stand = doc.weken[week].taken;
  assert.equal(stand[taken[0]].afgevinkt, true, 'afvinkje van de telefoon staat er');
  assert.equal(stand[taken[1]].afgevinkt, true, 'afvinkje van de laptop staat er');
});

test('een taak die tijdens het afvinken van de weeklijst wordt gehaald, geeft geen fout', async () => {
  const telefoon = nieuweOpslag('schoonmaakster');
  const laptop = nieuweOpslag('beheerder');
  await telefoon.begin();
  await laptop.begin();

  const week = weekSleutel(2026, 34);
  const taken = laptop.document().taken.slice(0, 3).map((t) => t.id);
  laptop.doe({ soort: 'week.taken', week, taakIds: taken });
  await laptop.verstuur();
  await telefoon.ververs({ geforceerd: true });

  // De telefoon vinkt af terwijl de beheerder die taak juist van de lijst haalt.
  telefoon.doe({ soort: 'weektaak.afvinken', week, taakId: taken[2], afgevinkt: true, tijd: 't' });
  laptop.doe({ soort: 'week.taken', week, taakIds: [taken[0], taken[1]] });
  await laptop.verstuur();
  await telefoon.verstuur();

  const doc = await nieuweOpslag().begin();
  assert.deepEqual(Object.keys(doc.weken[week].taken).sort(), [taken[0], taken[1]].sort());
  assert.equal(telefoon.wachtrij.length, 0, 'de wachtrij blijft niet hangen');
});

test('zonder netwerk blijft de wachtrij staan en gaat het later alsnog door', async () => {
  const opslag = nieuweOpslag('schoonmaakster');
  await opslag.begin();
  const week = weekSleutel(2026, 34);
  const taakId = opslag.document().taken[0].id;
  opslag.doe({ soort: 'week.taken', week, taakIds: [taakId] });
  await opslag.verstuur();

  github.offline = true;
  opslag.doe({ soort: 'weektaak.afvinken', week, taakId, afgevinkt: true, tijd: 't' });
  await opslag.verstuur();

  assert.equal(opslag.wachtrij.length, 1, 'blijft in de wachtrij staan');
  assert.ok(opslag.laatsteFout?.tijdelijk, 'wordt als tijdelijk gezien');
  assert.equal(opslag.document().weken[week].taken[taakId].afgevinkt, true, 'blijft wel zichtbaar');

  github.offline = false;
  await opslag.verstuur({ handmatig: true });
  assert.equal(opslag.wachtrij.length, 0);
  const doc = await nieuweOpslag().begin();
  assert.equal(doc.weken[week].taken[taakId].afgevinkt, true);
});

test('de wachtrij overleeft het sluiten van de pagina', async () => {
  const eerste = nieuweOpslag('schoonmaakster');
  await eerste.begin();
  const week = weekSleutel(2026, 34);
  const taakId = eerste.document().taken[0].id;
  eerste.doe({ soort: 'week.taken', week, taakIds: [taakId] });
  await eerste.verstuur();

  github.offline = true;
  eerste.doe({ soort: 'weektaak.afvinken', week, taakId, afgevinkt: true, tijd: 't' });
  await eerste.verstuur();

  // Pagina opnieuw geopend: zelfde opslagsleutel, dus de wachtrij komt terug.
  github.offline = false;
  const tweede = nieuweOpslag('schoonmaakster');
  assert.equal(tweede.wachtrij.length, 1, 'wachtrij teruggelezen uit localStorage');
  await tweede.begin();
  await tweede.verstuur();
  assert.equal((await nieuweOpslag().begin()).weken[week].taken[taakId].afgevinkt, true);
});

test('offline openen toont de laatst bekende stand', async () => {
  const eerste = nieuweOpslag('schoonmaakster');
  await eerste.begin();
  const aantalTaken = eerste.document().taken.length;

  github.offline = true;
  const tweede = nieuweOpslag('schoonmaakster');
  const doc = await tweede.begin();
  assert.equal(doc.taken.length, aantalTaken, 'werkt zonder netwerk');
  assert.ok(tweede.laatsteFout, 'maar meldt wel dat het niet lukte');
});

test('herhaald tikken op dezelfde taak levert één bewerking op', async () => {
  const opslag = nieuweOpslag('schoonmaakster');
  await opslag.begin();
  const week = weekSleutel(2026, 34);
  const taakId = opslag.document().taken[0].id;
  opslag.doe({ soort: 'week.taken', week, taakIds: [taakId] });
  await opslag.verstuur();

  for (const aan of [true, false, true, false, true]) {
    opslag.doe({ soort: 'weektaak.afvinken', week, taakId, afgevinkt: aan, tijd: 't' },
      { vervangSleutel: `afvink:${taakId}` });
  }
  assert.equal(opslag.wachtrij.length, 1, 'één bewerking in plaats van vijf');
  await opslag.verstuur();
  assert.equal((await nieuweOpslag().begin()).weken[week].taken[taakId].afgevinkt, true);
});

test('ongewijzigd verversen kost geen extra verkeer', async () => {
  const opslag = nieuweOpslag();
  await opslag.begin();
  const veranderd = await opslag.ververs();
  assert.equal(veranderd, false);
  assert.equal(github.tellers.get304, 1, 'GitHub antwoordde met 304');
});

test('een verkeerde sleutel blijft niet eeuwig opnieuw proberen', async () => {
  const opslag = new Opslag({ sleutel: 'foute-sleutel', dataGist: 'gist1', rol: 'beheerder' });
  let geblokkeerd = null;
  opslag.addEventListener('geblokkeerd', (e) => { geblokkeerd = e.detail.fout; });
  await assert.rejects(() => opslag.begin());

  opslag.doe({ soort: 'week.notitie', week: weekSleutel(2026, 34), notitie: 'test' });
  await opslag.verstuur();
  assert.ok(geblokkeerd, 'meldt dat het niet gaat lukken');
  assert.match(geblokkeerd.message, /sleutel/i);
  assert.equal(opslag.laatsteFout.tijdelijk, false, 'niet als tijdelijk gezien');
});

test('een beschadigd bestand in de Gist geeft een begrijpelijke melding', async () => {
  github.gists.get('gist1').bestanden['schoonmaak-bibliotheek.json'] = '{kapot';
  const opslag = nieuweOpslag();
  await assert.rejects(() => opslag.begin(), /beschadigd/i);
});

test('alleen de aangeraakte bestanden worden weggeschreven', async () => {
  const opslag = nieuweOpslag();
  await opslag.begin();
  const geschreven = [];
  const echteFetch = globalThis.fetch;
  globalThis.fetch = (url, opties) => {
    if (opties?.method === 'PATCH') geschreven.push(Object.keys(JSON.parse(opties.body).files));
    return echteFetch(url, opties);
  };
  opslag.doe({ soort: 'week.notitie', week: weekSleutel(2026, 34), notitie: 'alleen weken' });
  await opslag.verstuur();
  assert.deepEqual(geschreven, [['schoonmaak-weken.json']]);
});

test('een lege Gist levert een bruikbaar leeg document op', () => {
  const doc = bestandenNaarDocument({});
  assert.deepEqual(doc.ruimtes, []);
  assert.deepEqual(doc.taken, []);
  assert.deepEqual(doc.weken, {});
  assert.deepEqual(doc.berichten, []);
});

test('berichten krijgen geen duplicaat als er twee keer verstuurd wordt', async () => {
  const opslag = nieuweOpslag('schoonmaakster');
  await opslag.begin();
  const id = nieuwId('b');
  const bericht = { id, week: weekSleutel(2026, 34), afzender: 'schoonmaakster', tekst: 'Zeep is op', aangemaaktOp: 't', gelezen: false };
  opslag.doe({ soort: 'bericht.maak', bericht });
  await opslag.verstuur();
  // Nog eens hetzelfde bericht aanbieden, alsof een herhaald verzoek terugkomt.
  opslag.doe({ soort: 'bericht.maak', bericht });
  await opslag.verstuur();
  assert.equal((await nieuweOpslag().begin()).berichten.filter((b) => b.id === id).length, 1);
});

test('zonder leesbare ETag werkt alles nog, alleen minder zuinig', async () => {
  // Bij cross-origin verzoeken is de ETag alleen leesbaar als de server hem
  // vrijgeeft. Lukt dat niet, dan mag de app daar niet op stukgaan.
  github.verbergEtag = true;
  const opslag = nieuweOpslag('schoonmaakster');
  await opslag.begin();
  const week = weekSleutel(2026, 34);
  const taakId = opslag.document().taken[0].id;

  opslag.doe({ soort: 'week.taken', week, taakIds: [taakId] });
  await opslag.verstuur();
  opslag.doe({ soort: 'weektaak.afvinken', week, taakId, afgevinkt: true, tijd: 't' });
  await opslag.verstuur();

  assert.equal(opslag.wachtrij.length, 0);
  assert.equal(github.tellers.get304, 0, 'er komen geen 304-antwoorden');
  const doc = await nieuweOpslag().begin();
  assert.equal(doc.weken[week].taken[taakId].afgevinkt, true, 'maar opslaan lukt gewoon');

  assert.equal(await opslag.ververs(), true, 'verversen haalt dan elke keer alles op');
});

test('foto\'s worden maar één keer opgehaald', async () => {
  const { FotoOpslag } = await import('../app/js/fotos.js');
  github.maakGist('fotogist', { 'foto-f1.b64': 'AAAA', 'foto-f2.b64': 'BBBB' });
  const toegang = { sleutel: 'goede-sleutel', dataGist: 'gist1', fotoGist: 'fotogist', rol: 'schoonmaakster' };

  const fotos = new FotoOpslag(toegang);
  await fotos.laad(['f1']);
  assert.match(fotos.url('f1'), /^data:image\/jpeg;base64,AAAA$/);
  const naEerste = github.tellers.get;

  await fotos.laad(['f1', 'f2']);
  assert.equal(github.tellers.get, naEerste, 'alles al binnen: geen nieuw verzoek');

  await fotos.laad(['f3']);
  assert.equal(github.tellers.get, naEerste + 1, 'een onbekende foto zorgt wel voor een verzoek');
});
