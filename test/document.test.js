import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leegDocument, pasToe, speelAf, weekSleutel, nieuwId, weekOverzicht, weekSamensteller,
  historie, taakHistorie, alleOpmerkingen, aantalOngelezen, takenVanVorigeWeek,
  ruimteLijst, taakLijst, laatstGedaan, haalWeek,
  lopendBezoek, gewerkteMinuten, vergetenBezoeken, alsDuur,
} from '../app/js/document.js';
import { maakVoorbeeldDocument } from '../app/js/seed.js';

const W34 = weekSleutel(2026, 34);
const W33 = weekSleutel(2026, 33);

function metWeek(doc, sleutel, taakIds) {
  return pasToe(doc, { soort: 'week.taken', week: sleutel, taakIds });
}

test('de voorbeeldbibliotheek is compleet en samenhangend', () => {
  const doc = maakVoorbeeldDocument();
  assert.ok(doc.taken.length >= 40);
  assert.ok(doc.ruimtes.length >= 8);
  const ruimteIds = new Set(doc.ruimtes.map((r) => r.id));
  assert.ok(doc.taken.every((t) => ruimteIds.has(t.ruimteId)), 'elke taak hoort bij een bestaande ruimte');
  assert.ok(doc.taken.every((t) => t.titel && t.omschrijving && t.standaardFrequentie));
  assert.equal(new Set(doc.taken.map((t) => t.id)).size, doc.taken.length, 'geen dubbele ids');
});

test('een bewerking laat het oorspronkelijke document met rust', () => {
  const doc = maakVoorbeeldDocument();
  const kopie = JSON.stringify(doc);
  pasToe(doc, { soort: 'taak.bewerk', id: doc.taken[0].id, velden: { titel: 'Anders' } });
  assert.equal(JSON.stringify(doc), kopie);
});

test('bewerkingen twee keer afspelen geeft hetzelfde resultaat', () => {
  const doc = maakVoorbeeldDocument();
  const taakId = doc.taken[0].id;
  const bewerkingen = [
    { soort: 'week.taken', week: W34, taakIds: [taakId] },
    { soort: 'weektaak.afvinken', week: W34, taakId, afgevinkt: true, tijd: 't1' },
    { soort: 'weektaak.opmerking', week: W34, taakId, opmerking: 'lekt' },
    { soort: 'bericht.maak', bericht: { id: 'b1', week: W34, afzender: 'schoonmaakster', tekst: 'hoi', aangemaaktOp: 't', gelezen: false } },
  ];
  const eenmaal = speelAf(doc, bewerkingen);
  const tweemaal = speelAf(eenmaal, bewerkingen);
  assert.deepEqual(tweemaal, eenmaal, 'herhalen mag niets veranderen');
});

test('een taak van de weeklijst halen en terugzetten wist het afvinkje niet meteen', () => {
  let doc = maakVoorbeeldDocument();
  const [a, b] = doc.taken.map((t) => t.id);
  doc = metWeek(doc, W34, [a, b]);
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W34, taakId: a, afgevinkt: true, tijd: 't' });

  doc = metWeek(doc, W34, [a]); // b eraf, a blijft
  assert.equal(doc.weken[W34].taken[a].afgevinkt, true, 'a houdt zijn afvinkje');
  assert.equal(doc.weken[W34].taken[b], undefined);

  doc = metWeek(doc, W34, [a, b]); // b weer erbij
  assert.equal(doc.weken[W34].taken[b].afgevinkt, false, 'b begint schoon');
});

test('afvinken van een taak die niet op de lijst staat, doet niets', () => {
  let doc = maakVoorbeeldDocument();
  doc = metWeek(doc, W34, [doc.taken[0].id]);
  const voor = JSON.stringify(doc);
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W34, taakId: 'bestaat-niet', afgevinkt: true, tijd: 't' });
  assert.equal(JSON.stringify(doc), voor);
});

test('afvinken ongedaan maken wist het tijdstempel', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = doc.taken[0].id;
  doc = metWeek(doc, W34, [taakId]);
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W34, taakId, afgevinkt: true, tijd: '2026-08-21T10:00:00Z' });
  assert.equal(doc.weken[W34].taken[taakId].afgevinktOp, '2026-08-21T10:00:00Z');
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W34, taakId, afgevinkt: false, tijd: 'x' });
  assert.equal(doc.weken[W34].taken[taakId].afgevinktOp, null);
});

test('het weekoverzicht groepeert per ruimte in de juiste volgorde', () => {
  let doc = maakVoorbeeldDocument();
  doc = metWeek(doc, W34, doc.taken.map((t) => t.id));
  const overzicht = weekOverzicht(doc, 2026, 34);
  const ruimteVolgorde = ruimteLijst(doc).map((r) => r.id);
  const gezien = overzicht.groepen.map((g) => g.ruimteId);
  assert.deepEqual(gezien, ruimteVolgorde.filter((id) => gezien.includes(id)));
  assert.equal(overzicht.voortgang.totaal, doc.taken.length);
});

test('een archiveerde taak blijft in de historie zichtbaar', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = doc.taken[0].id;
  doc = metWeek(doc, W33, [taakId]);
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W33, taakId, afgevinkt: true, tijd: 't' });
  doc = pasToe(doc, { soort: 'taak.bewerk', id: taakId, velden: { actief: false } });

  assert.ok(!taakLijst(doc).some((t) => t.id === taakId), 'niet meer in de actieve lijst');
  assert.equal(taakHistorie(doc, taakId).length, 1, 'wel nog in de historie');
  assert.equal(weekOverzicht(doc, 2026, 33).voortgang.gedaan, 1, 'telt nog mee in die week');
});

test('wekenGeleden kijkt alleen naar weken die al geweest zijn', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = doc.taken[0].id;
  const W29 = weekSleutel(2026, 29);
  doc = metWeek(doc, W29, [taakId]);
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W29, taakId, afgevinkt: true, tijd: 't' });

  const nu = weekSamensteller(doc, 2026, 34).groepen.flatMap((g) => g.taken).find((t) => t.id === taakId);
  assert.equal(nu.wekenGeleden, 5);

  const eerder = weekSamensteller(doc, 2026, 28).groepen.flatMap((g) => g.taken).find((t) => t.id === taakId);
  assert.equal(eerder.wekenGeleden, null, 'een latere week telt niet mee');
});

test('nooit gedane taken hebben geen "wekenGeleden"', () => {
  const doc = maakVoorbeeldDocument();
  const alle = weekSamensteller(doc, 2026, 34).groepen.flatMap((g) => g.taken);
  assert.ok(alle.every((t) => t.wekenGeleden === null));
  assert.equal(laatstGedaan(doc, '2026-08-17').size, 0);
});

test('vorige week kopiëren neemt alleen actieve taken mee', () => {
  let doc = maakVoorbeeldDocument();
  const [a, b] = doc.taken.map((t) => t.id);
  doc = metWeek(doc, W33, [a, b]);
  doc = pasToe(doc, { soort: 'taak.bewerk', id: b, velden: { actief: false } });
  assert.deepEqual(takenVanVorigeWeek(doc, 2026, 34), [a]);
});

test('kopiëren over de jaargrens pakt de goede week', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = doc.taken[0].id;
  doc = metWeek(doc, weekSleutel(2025, 52), [taakId]);
  assert.deepEqual(takenVanVorigeWeek(doc, 2026, 1), [taakId]);
});

test('de historie telt gepland en afgevinkt per week', () => {
  let doc = maakVoorbeeldDocument();
  const ids = doc.taken.slice(0, 4).map((t) => t.id);
  doc = metWeek(doc, W33, ids);
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W33, taakId: ids[0], afgevinkt: true, tijd: 't' });
  doc = metWeek(doc, W34, ids.slice(0, 2));

  const lijst = historie(doc);
  assert.equal(lijst[0].weeknummer, 34, 'nieuwste eerst');
  const w33 = lijst.find((w) => w.weeknummer === 33);
  assert.equal(w33.gepland, 4);
  assert.equal(w33.afgevinkt, 1);
});

test('opmerkingen komen samen in één overzicht', () => {
  let doc = maakVoorbeeldDocument();
  const [a, b] = doc.taken.map((t) => t.id);
  doc = metWeek(doc, W34, [a, b]);
  doc = pasToe(doc, { soort: 'weektaak.opmerking', week: W34, taakId: a, opmerking: 'Kraan lekt' });
  doc = pasToe(doc, { soort: 'weektaak.opmerking', week: W34, taakId: b, opmerking: '   ' });
  const lijst = alleOpmerkingen(doc);
  assert.equal(lijst.length, 1, 'lege opmerkingen tellen niet mee');
  assert.equal(lijst[0].opmerking, 'Kraan lekt');
  assert.ok(lijst[0].titel && lijst[0].ruimteNaam);
});

test('ongelezen berichten tellen alleen die van de ander', () => {
  let doc = leegDocument();
  const maak = (afzender, id) => ({
    soort: 'bericht.maak',
    bericht: { id, week: W34, afzender, tekst: 'x', aangemaaktOp: 't', gelezen: false },
  });
  doc = pasToe(doc, maak('schoonmaakster', 'b1'));
  doc = pasToe(doc, maak('beheerder', 'b2'));
  assert.equal(aantalOngelezen(doc, 'beheerder'), 1);
  assert.equal(aantalOngelezen(doc, 'schoonmaakster'), 1);

  doc = pasToe(doc, { soort: 'berichten.allesGelezen', afzender: 'schoonmaakster' });
  assert.equal(aantalOngelezen(doc, 'beheerder'), 0);
  assert.equal(aantalOngelezen(doc, 'schoonmaakster'), 1, 'de ander blijft ongelezen');
});

test('ruimtes herordenen verandert de volgorde van de taken', () => {
  const doc = maakVoorbeeldDocument();
  const ids = ruimteLijst(doc).map((r) => r.id);
  const omgedraaid = [...ids].reverse();
  const na = pasToe(doc, { soort: 'ruimte.volgorde', ids: omgedraaid });
  assert.deepEqual(ruimteLijst(na).map((r) => r.id), omgedraaid);
  assert.equal(taakLijst(na)[0].ruimteId, omgedraaid[0]);
});

test('een nieuwe taak komt achteraan in zijn eigen ruimte', () => {
  let doc = maakVoorbeeldDocument();
  const ruimteId = doc.ruimtes[0].id;
  const aantalVoor = doc.taken.filter((t) => t.ruimteId === ruimteId).length;
  const id = nieuwId('t');
  doc = pasToe(doc, {
    soort: 'taak.maak',
    taak: { id, titel: 'Nieuw', ruimteId, omschrijving: '', standaardFrequentie: 'wekelijks', geschatteMinuten: null, fotoId: null },
  });
  const inRuimte = taakLijst(doc).filter((t) => t.ruimteId === ruimteId);
  assert.equal(inRuimte.length, aantalVoor + 1);
  assert.equal(inRuimte[inRuimte.length - 1].id, id, 'staat achteraan');
});

test('een onbekende bewerking laat het document heel', () => {
  const doc = maakVoorbeeldDocument();
  const na = pasToe(doc, { soort: 'iets.nieuws.uit.de.toekomst', van: 'alles' });
  assert.deepEqual(na.taken, doc.taken);
  assert.deepEqual(na.ruimtes, doc.ruimtes);
});

test('een week zonder taken geeft een bruikbaar leeg overzicht', () => {
  const overzicht = weekOverzicht(maakVoorbeeldDocument(), 2030, 5);
  assert.deepEqual(overzicht.voortgang, { gedaan: 0, totaal: 0 });
  assert.deepEqual(overzicht.groepen, []);
  assert.equal(overzicht.week.startdatum, '2030-01-28');
  assert.equal(overzicht.week.notitie, '');
});

/* ------------------------------------------------- starten en klaar melden */

test('starten en klaar melden legt de gewerkte tijd vast', () => {
  let doc = leegDocument();
  doc = pasToe(doc, { soort: 'bezoek.start', week: W34, id: 'v1', tijd: '2026-08-18T09:00:00' });
  const tussentijds = weekOverzicht(doc, 2026, 34);
  assert.equal(tussentijds.bezoeken.length, 1);
  assert.ok(lopendBezoek(tussentijds.week), 'het bezoek loopt nog');

  doc = pasToe(doc, { soort: 'bezoek.stop', week: W34, id: 'v1', tijd: '2026-08-18T11:30:00' });
  const week = haalWeek(doc, 2026, 34);
  assert.equal(lopendBezoek(week), null);
  assert.equal(gewerkteMinuten(week), 150);
  assert.equal(alsDuur(150), '2 uur 30');
});

test('twee keer op start tikken maakt geen tweede bezoek', () => {
  let doc = leegDocument();
  const start = { soort: 'bezoek.start', week: W34, id: 'v1', tijd: '2026-08-18T09:00:00' };
  doc = pasToe(doc, start);
  doc = pasToe(doc, start);
  assert.equal(haalWeek(doc, 2026, 34).bezoeken.length, 1);
});

test('meerdere bezoeken in een week tellen bij elkaar op', () => {
  let doc = leegDocument();
  for (const [id, van, tot] of [
    ['v1', '2026-08-18T09:00:00', '2026-08-18T10:00:00'],
    ['v2', '2026-08-20T13:00:00', '2026-08-20T14:45:00'],
  ]) {
    doc = pasToe(doc, { soort: 'bezoek.start', week: W34, id, tijd: van });
    doc = pasToe(doc, { soort: 'bezoek.stop', week: W34, id, tijd: tot });
  }
  assert.equal(gewerkteMinuten(haalWeek(doc, 2026, 34)), 165);
});

test('een bezoek dat nog loopt telt mee tot nu', () => {
  const nu = new Date('2026-08-18T11:00:00');
  let doc = leegDocument();
  doc = pasToe(doc, { soort: 'bezoek.start', week: W34, id: 'v1', tijd: '2026-08-18T09:30:00' });
  assert.equal(gewerkteMinuten(haalWeek(doc, 2026, 34), nu), 90);
});

test('een vergeten bezoek van een eerdere dag telt niet mee', () => {
  const nu = new Date('2026-08-20T11:00:00');
  let doc = leegDocument();
  doc = pasToe(doc, { soort: 'bezoek.start', week: W34, id: 'v1', tijd: '2026-08-18T09:00:00' });
  const week = haalWeek(doc, 2026, 34);
  assert.equal(gewerkteMinuten(week, nu), 0, 'anders zou er een absurd aantal uren staan');
  assert.equal(vergetenBezoeken(week, nu).length, 1, 'maar het wordt wel gemeld');
});

test('stoppen zonder start doet niets', () => {
  const doc = pasToe(leegDocument(), { soort: 'bezoek.stop', week: W34, id: 'onbekend', tijd: 't' });
  assert.deepEqual(haalWeek(doc, 2026, 34).bezoeken, []);
});

test('bezoeken zijn ook veilig om opnieuw af te spelen', () => {
  const bewerkingen = [
    { soort: 'bezoek.start', week: W34, id: 'v1', tijd: '2026-08-18T09:00:00' },
    { soort: 'bezoek.stop', week: W34, id: 'v1', tijd: '2026-08-18T11:00:00' },
  ];
  const eenmaal = speelAf(leegDocument(), bewerkingen);
  assert.deepEqual(speelAf(eenmaal, bewerkingen), eenmaal);
});

test('de historie toont de gewerkte tijd per week', () => {
  let doc = maakVoorbeeldDocument();
  doc = metWeek(doc, W33, [doc.taken[0].id]);
  doc = pasToe(doc, { soort: 'bezoek.start', week: W33, id: 'v1', tijd: '2026-08-11T09:00:00' });
  doc = pasToe(doc, { soort: 'bezoek.stop', week: W33, id: 'v1', tijd: '2026-08-11T12:15:00' });
  const w33 = historie(doc).find((w) => w.weeknummer === 33);
  assert.equal(w33.gewerkteMinuten, 195);
  assert.equal(alsDuur(w33.gewerkteMinuten), '3 uur 15');
});

test('een week met alleen een bezoek verschijnt toch in de historie', () => {
  let doc = leegDocument();
  doc = pasToe(doc, { soort: 'bezoek.start', week: W33, id: 'v1', tijd: '2026-08-11T09:00:00' });
  doc = pasToe(doc, { soort: 'bezoek.stop', week: W33, id: 'v1', tijd: '2026-08-11T10:00:00' });
  assert.equal(historie(doc).length, 1);
});

test('alsDuur schrijft tijden uit zoals je ze zegt', () => {
  assert.equal(alsDuur(0), '0 min');
  assert.equal(alsDuur(45), '45 min');
  assert.equal(alsDuur(60), '1 uur');
  assert.equal(alsDuur(125), '2 uur 05');
  assert.equal(alsDuur(180), '3 uur');
});
