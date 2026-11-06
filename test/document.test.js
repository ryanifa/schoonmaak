import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leegDocument, pasToe, speelAf, weekSleutel, nieuwId, weekOverzicht, weekSamensteller,
  historie, taakHistorie, alleOpmerkingen, aantalOngelezen, takenVanVorigeWeek,
  ruimteLijst, taakLijst, laatstGedaan, haalWeek,
  lopendBezoek, gewerkteMinuten, alsDuur, bezoekMinuten,
  autoStopBewerkingen, herinneringNummer, automatischGestopteBezoeken, werktijden, WERKTIJD,
  altijdOpDeLijst, resultaatTelling, TAAKTYPES, tijdBegroting, watStaatNogOpen, gesprek,
  schoonmakerLijst, standaardSchoonmaker, schoonmakerNaam, historieOmvang,
} from '../app/js/document.js';
import { maakVoorbeeldDocument } from '../app/js/seed.js';

const W34 = weekSleutel(2026, 34);
const W33 = weekSleutel(2026, 33);

function metWeek(doc, sleutel, taakIds) {
  return pasToe(doc, { soort: 'week.taken', week: sleutel, taakIds });
}

test('de voorbeeldbibliotheek is compleet en samenhangend', () => {
  const doc = maakVoorbeeldDocument();
  assert.ok(doc.taken.length >= 25);
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
  const [a, b] = doc.taken.filter((t) => t.type === 'wekelijks').map((t) => t.id);
  doc = metWeek(doc, W33, [a, b]);
  doc = pasToe(doc, { soort: 'taak.bewerk', id: b, velden: { actief: false } });
  const over = takenVanVorigeWeek(doc, 2026, 34);
  assert.ok(over.includes(a));
  assert.ok(!over.includes(b), 'de gearchiveerde taak gaat niet mee');
});

test('kopiëren over de jaargrens pakt de goede week', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = doc.taken.find((t) => t.type === 'wekelijks').id;
  doc = metWeek(doc, weekSleutel(2025, 52), [taakId]);
  assert.ok(takenVanVorigeWeek(doc, 2026, 1).includes(taakId));
});

test('de historie telt gepland en afgevinkt per week', () => {
  let doc = maakVoorbeeldDocument();
  const ids = doc.taken.filter((t) => t.type === 'wekelijks').slice(0, 4).map((t) => t.id);
  doc = metWeek(doc, W33, ids);
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W33, taakId: ids[0], afgevinkt: true, tijd: 't' });
  doc = metWeek(doc, W34, ids.slice(0, 2));

  const lijst = historie(doc);
  assert.equal(lijst[0].weeknummer, 34, 'nieuwste eerst');
  const w33 = lijst.find((w) => w.weeknummer === 33);
  // De vier gekozen taken plus de vijf opruimtaken die er altijd bij horen.
  assert.equal(w33.gepland, 4 + altijdOpDeLijst(doc).length);
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

test('een week die de beheerder nooit heeft aangeraakt toont alleen de opruimtaken', () => {
  const doc = maakVoorbeeldDocument();
  const overzicht = weekOverzicht(doc, 2030, 5);
  assert.equal(overzicht.voortgang.gedaan, 0);
  assert.equal(overzicht.voortgang.totaal, altijdOpDeLijst(doc).length);
  assert.ok(overzicht.regels.every((r) => r.type === 'indien_nodig'));
  assert.equal(overzicht.week.startdatum, '2030-01-28');
  assert.equal(overzicht.week.notitie, '');
});

test('een leeg document geeft een leeg weekoverzicht', () => {
  const overzicht = weekOverzicht(leegDocument(), 2030, 5);
  assert.deepEqual(overzicht.voortgang, { gedaan: 0, totaal: 0 });
  assert.deepEqual(overzicht.groepen, []);
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

test('een lopend bezoek telt nooit langer dan de grens', () => {
  const nu = new Date('2026-08-20T11:00:00');
  let doc = leegDocument();
  doc = pasToe(doc, { soort: 'bezoek.start', week: W34, id: 'v1', tijd: '2026-08-18T09:00:00' });
  // Twee dagen geleden begonnen: zonder grens zou hier een absurd getal staan.
  assert.equal(gewerkteMinuten(haalWeek(doc, 2026, 34), nu), WERKTIJD.stopNa);
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

/* --------------------------------------------- taaktypes en opruimtaken --- */

test('de bibliotheek van dit huis klopt met de rondgang', () => {
  const doc = maakVoorbeeldDocument();
  const namen = ruimteLijst(doc).map((r) => r.naam);
  assert.deepEqual(namen, [
    'Keuken', 'Woonkamer', 'Hal en trap', 'Overloop', 'Badkamer',
    'Sportkamer', 'Studeerkamer', 'Slaapkamer', 'Trap naar dakkamer', 'Dakkamer',
  ]);
  assert.equal(doc.taken.length, 28);
  assert.ok(doc.taken.every((t) => TAAKTYPES.includes(t.type)), 'elke taak heeft een geldig type');

  const opruimen = altijdOpDeLijst(doc).map((t) => t.titel);
  assert.deepEqual(opruimen, [
    'Keuken opruimen', 'Badkamer opruimen', 'Sportkamer opruimen', 'Bed opmaken', 'Keukentje opruimen',
  ]);
});

test('elke laminaatvloer waarschuwt voor nat dweilen', () => {
  const doc = maakVoorbeeldDocument();
  const ruimtes = new Map(doc.ruimtes.map((r) => [r.id, r.naam]));
  const laminaat = ['Hal en trap', 'Overloop', 'Sportkamer', 'Studeerkamer', 'Slaapkamer', 'Trap naar dakkamer', 'Dakkamer'];
  for (const naam of laminaat) {
    const dweilen = doc.taken.filter(
      (t) => ruimtes.get(t.ruimteId) === naam && /dweil/i.test(t.titel),
    );
    assert.ok(dweilen.length > 0, `${naam} heeft een dweiltaak`);
    for (const taak of dweilen) {
      assert.match(taak.omschrijving, /nevelvochtig/, `${naam}: ${taak.titel}`);
    }
  }
  // De woonkamer heeft zeil, maar het keukendeel is laminaat: ook daar de waarschuwing.
  const vloer = doc.taken.find((t) => t.titel === 'Vloer keuken en woonkamer dweilen');
  assert.match(vloer.omschrijving, /zeil/);
  assert.match(vloer.omschrijving, /nevelvochtig/);
});

test('een opruimtaak staat op de weeklijst ook als de beheerder hem niet kiest', () => {
  let doc = maakVoorbeeldDocument();
  const wekelijks = doc.taken.filter((t) => t.type === 'wekelijks').map((t) => t.id);
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: wekelijks });

  const overzicht = weekOverzicht(doc, 2026, 34);
  const opruimen = overzicht.regels.filter((r) => r.type === 'indien_nodig');
  assert.equal(opruimen.length, 5, 'alle vijf opruimtaken staan erbij');
  assert.ok(opruimen.every((r) => !r.afgevinkt && r.resultaat === null));
});

test('een opruimtaak die de beheerder wegklikt blijft weg', () => {
  // De weeklijst uit het beheerscherm stuurt mee waar hij uit kon kiezen. Alles
  // wat hij toen zag maar niet aanvinkte, laat hij bewust weg.
  let doc = maakVoorbeeldDocument();
  const alles = doc.taken.map((t) => t.id);
  const [weg, ...rest] = altijdOpDeLijst(doc).map((t) => t.id);
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: rest, bekend: alles });

  const regels = weekOverzicht(doc, 2026, 34).regels;
  assert.equal(regels.length, 4, 'alleen de vier overgebleven opruimtaken');
  assert.ok(!regels.some((r) => r.taakId === weg), 'de weggeklikte staat er niet meer');

  // En opnieuw afspelen laat hem niet stiekem terugkomen.
  const nogmaals = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: rest, bekend: alles });
  assert.equal(weekOverzicht(nogmaals, 2026, 34).regels.length, 4);
});

test('"alles uit" haalt echt alles van de lijst', () => {
  let doc = maakVoorbeeldDocument();
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: [], bekend: doc.taken.map((t) => t.id) });
  assert.equal(weekOverzicht(doc, 2026, 34).regels.length, 0);
});

test('een nieuwe opruimtaak verschijnt meteen in een al samengestelde week', () => {
  let doc = maakVoorbeeldDocument();
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: [], bekend: doc.taken.map((t) => t.id) });
  const voor = weekOverzicht(doc, 2026, 34).regels.length;

  doc = pasToe(doc, {
    soort: 'taak.maak',
    taak: {
      id: 'nieuw', titel: 'Zolder opruimen', ruimteId: doc.ruimtes[0].id,
      omschrijving: '', type: 'indien_nodig', standaardFrequentie: 'wekelijks', geschatteMinuten: null, fotoId: null,
    },
  });
  const na = weekOverzicht(doc, 2026, 34);
  assert.equal(na.regels.length, voor + 1);

  // En hij is meteen te beantwoorden, zonder dat de beheerder iets doet.
  doc = pasToe(doc, { soort: 'weektaak.resultaat', week: W34, taakId: 'nieuw', resultaat: 'zelf_gedaan', tijd: 't' });
  assert.equal(weekOverzicht(doc, 2026, 34).regels.find((r) => r.taakId === 'nieuw').resultaat, 'zelf_gedaan');
});

test('beide antwoorden op een opruimtaak tellen als afgerond', () => {
  let doc = maakVoorbeeldDocument();
  const [a, b] = altijdOpDeLijst(doc).map((t) => t.id);
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: [] });

  doc = pasToe(doc, { soort: 'weektaak.resultaat', week: W34, taakId: a, resultaat: 'was_al_gedaan', tijd: 't1' });
  doc = pasToe(doc, { soort: 'weektaak.resultaat', week: W34, taakId: b, resultaat: 'zelf_gedaan', tijd: 't2' });

  const overzicht = weekOverzicht(doc, 2026, 34);
  assert.equal(overzicht.voortgang.gedaan, 2);
  assert.ok(overzicht.regels.filter((r) => r.afgevinkt).every((r) => r.afgevinktOp));
});

test('een antwoord kan teruggedraaid worden', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = altijdOpDeLijst(doc)[0].id;
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: [] });
  doc = pasToe(doc, { soort: 'weektaak.resultaat', week: W34, taakId, resultaat: 'zelf_gedaan', tijd: 't' });
  doc = pasToe(doc, { soort: 'weektaak.resultaat', week: W34, taakId, resultaat: null, tijd: 't' });

  const regel = weekOverzicht(doc, 2026, 34).regels.find((r) => r.taakId === taakId);
  assert.equal(regel.resultaat, null);
  assert.equal(regel.afgevinkt, false);
  assert.equal(regel.afgevinktOp, null);
});

test('het onderscheid tussen "al in orde" en "zelf gedaan" blijft in de historie', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = altijdOpDeLijst(doc)[0].id;
  const weken = [weekSleutel(2026, 31), weekSleutel(2026, 32), weekSleutel(2026, 33), W34];
  const antwoorden = ['was_al_gedaan', 'zelf_gedaan', 'was_al_gedaan', 'was_al_gedaan'];
  weken.forEach((week, i) => {
    doc = pasToe(doc, { soort: 'week.taken', week, taakIds: [] });
    doc = pasToe(doc, { soort: 'weektaak.resultaat', week, taakId, resultaat: antwoorden[i], tijd: 't' });
  });

  const telling = resultaatTelling(doc, taakId);
  assert.deepEqual(telling, { was_al_gedaan: 3, zelf_gedaan: 1, open: 0, weken: 4 });

  const regels = taakHistorie(doc, taakId);
  assert.equal(regels[0].resultaat, 'was_al_gedaan');
  assert.ok(regels.every((r) => r.resultaat));
});

test('een onbeantwoorde opruimtaak telt als open, niet als een antwoord', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = altijdOpDeLijst(doc)[0].id;
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: [] });
  assert.deepEqual(resultaatTelling(doc, taakId), { was_al_gedaan: 0, zelf_gedaan: 0, open: 1, weken: 1 });
});

test('afvinken wist het resultaat, zodat er geen halve stand achterblijft', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = altijdOpDeLijst(doc)[0].id;
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: [] });
  doc = pasToe(doc, { soort: 'weektaak.resultaat', week: W34, taakId, resultaat: 'zelf_gedaan', tijd: 't' });
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W34, taakId, afgevinkt: false, tijd: 't' });
  const regel = weekOverzicht(doc, 2026, 34).regels.find((r) => r.taakId === taakId);
  assert.equal(regel.resultaat, null);
  assert.equal(regel.afgevinkt, false);
});

test('een resultaat opnieuw afspelen verandert niets', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = altijdOpDeLijst(doc)[0].id;
  const bewerkingen = [
    { soort: 'week.taken', week: W34, taakIds: [] },
    { soort: 'weektaak.resultaat', week: W34, taakId, resultaat: 'was_al_gedaan', tijd: 't' },
  ];
  const eenmaal = speelAf(doc, bewerkingen);
  assert.deepEqual(speelAf(eenmaal, bewerkingen), eenmaal);
});

test('een gearchiveerde opruimtaak verdwijnt van een nog onaangeroerde week', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = altijdOpDeLijst(doc)[0].id;
  assert.equal(weekOverzicht(doc, 2026, 34).regels.length, 5);
  doc = pasToe(doc, { soort: 'taak.bewerk', id: taakId, velden: { actief: false } });
  assert.equal(weekOverzicht(doc, 2026, 34).regels.length, 4);
});

test('een al beantwoorde opruimtaak blijft staan als hij daarna wordt gearchiveerd', () => {
  // Anders zou het werk van die week uit het overzicht verdwijnen.
  let doc = maakVoorbeeldDocument();
  const taakId = altijdOpDeLijst(doc)[0].id;
  doc = pasToe(doc, { soort: 'weektaak.resultaat', week: W34, taakId, resultaat: 'zelf_gedaan', tijd: 't' });
  doc = pasToe(doc, { soort: 'taak.bewerk', id: taakId, velden: { actief: false } });

  const regel = weekOverzicht(doc, 2026, 34).regels.find((r) => r.taakId === taakId);
  assert.ok(regel, 'staat er nog');
  assert.equal(regel.resultaat, 'zelf_gedaan');
  assert.equal(resultaatTelling(doc, taakId).zelf_gedaan, 1);
});

test('taken uit een oudere versie krijgen vanzelf een type', () => {
  const doc = {
    versie: 1,
    ruimtes: [{ id: 'r1', naam: 'Keuken', volgorde: 0, actief: true }],
    taken: [
      { id: 't1', titel: 'Elke week', ruimteId: 'r1', standaardFrequentie: 'wekelijks', volgorde: 0, actief: true },
      { id: 't2', titel: 'Af en toe', ruimteId: 'r1', standaardFrequentie: 'maandelijks', volgorde: 1, actief: true },
    ],
    weken: {},
    berichten: [],
  };
  const lijst = taakLijst(doc);
  assert.equal(lijst.find((t) => t.id === 't1').type, 'wekelijks');
  assert.equal(lijst.find((t) => t.id === 't2').type, 'periodiek');
});

/* ------------------------------------------------------- schoonmaaksters --- */

test('de eerste schoonmaakster wordt vanzelf de standaard', () => {
  let doc = leegDocument();
  assert.equal(standaardSchoonmaker(doc), null, 'zolang er niemand is, valt er niets te kiezen');

  doc = pasToe(doc, { soort: 'schoonmaker.maak', id: 's1', naam: 'Anna' });
  assert.equal(standaardSchoonmaker(doc).naam, 'Anna');

  doc = pasToe(doc, { soort: 'schoonmaker.maak', id: 's2', naam: 'Fatima' });
  assert.equal(standaardSchoonmaker(doc).naam, 'Anna', 'de tweede neemt het niet over');
  assert.deepEqual(schoonmakerLijst(doc).map((s) => s.naam), ['Anna', 'Fatima']);
});

test('de beheerder kan een andere standaard aanwijzen', () => {
  let doc = pasToe(leegDocument(), { soort: 'schoonmaker.maak', id: 's1', naam: 'Anna' });
  doc = pasToe(doc, { soort: 'schoonmaker.maak', id: 's2', naam: 'Fatima' });
  doc = pasToe(doc, { soort: 'instelling.zet', sleutel: 'standaardSchoonmaker', waarde: 's2' });
  assert.equal(standaardSchoonmaker(doc).naam, 'Fatima');
});

test('een gearchiveerde schoonmaakster kan geen standaard blijven', () => {
  let doc = pasToe(leegDocument(), { soort: 'schoonmaker.maak', id: 's1', naam: 'Anna' });
  doc = pasToe(doc, { soort: 'schoonmaker.maak', id: 's2', naam: 'Fatima' });
  doc = pasToe(doc, { soort: 'instelling.zet', sleutel: 'standaardSchoonmaker', waarde: 's2' });
  doc = pasToe(doc, { soort: 'schoonmaker.bewerk', id: 's2', velden: { actief: false } });

  assert.equal(standaardSchoonmaker(doc).naam, 'Anna', 'valt terug op wie er nog wel is');
  assert.deepEqual(schoonmakerLijst(doc).map((s) => s.naam), ['Anna'], 'staat niet meer in haar keuzelijst');
  assert.equal(schoonmakerNaam(doc, 's2'), 'Fatima', 'maar oude bezoeken houden haar naam');
});

test('archiveren van de laatste laat geen standaard achter die niet bestaat', () => {
  let doc = pasToe(leegDocument(), { soort: 'schoonmaker.maak', id: 's1', naam: 'Anna' });
  doc = pasToe(doc, { soort: 'schoonmaker.bewerk', id: 's1', velden: { actief: false } });
  assert.equal(standaardSchoonmaker(doc), null);
  assert.equal(doc.instellingen.standaardSchoonmaker, null);
});

test('een bezoek onthoudt wie er werkte', () => {
  let doc = pasToe(leegDocument(), { soort: 'schoonmaker.maak', id: 's1', naam: 'Anna' });
  doc = pasToe(doc, { soort: 'bezoek.start', week: W34, id: 'b1', tijd: '2026-08-18T09:00:00', schoonmakerId: 's1' });
  doc = pasToe(doc, { soort: 'bezoek.stop', week: W34, id: 'b1', tijd: '2026-08-18T11:00:00' });

  const bezoek = haalWeek(doc, 2026, 34).bezoeken[0];
  assert.equal(bezoek.schoonmakerId, 's1');
  assert.equal(schoonmakerNaam(doc, bezoek.schoonmakerId), 'Anna');
  assert.equal(gewerkteMinuten(haalWeek(doc, 2026, 34)), 120);
});

test('twee schoonmaaksters in dezelfde week blijven uit elkaar', () => {
  let doc = pasToe(leegDocument(), { soort: 'schoonmaker.maak', id: 's1', naam: 'Anna' });
  doc = pasToe(doc, { soort: 'schoonmaker.maak', id: 's2', naam: 'Fatima' });
  doc = pasToe(doc, { soort: 'bezoek.start', week: W34, id: 'b1', tijd: '2026-08-18T09:00:00', schoonmakerId: 's1' });
  doc = pasToe(doc, { soort: 'bezoek.stop', week: W34, id: 'b1', tijd: '2026-08-18T10:00:00' });
  doc = pasToe(doc, { soort: 'bezoek.start', week: W34, id: 'b2', tijd: '2026-08-20T13:00:00', schoonmakerId: 's2' });
  doc = pasToe(doc, { soort: 'bezoek.stop', week: W34, id: 'b2', tijd: '2026-08-20T15:00:00' });

  const week = haalWeek(doc, 2026, 34);
  assert.deepEqual(week.bezoeken.map((b) => schoonmakerNaam(doc, b.schoonmakerId)), ['Anna', 'Fatima']);
  assert.equal(gewerkteMinuten(week), 180, 'de uren tellen wel gewoon bij elkaar op');
});

test('zonder schoonmaaksters werkt starten gewoon', () => {
  let doc = leegDocument();
  doc = pasToe(doc, { soort: 'bezoek.start', week: W34, id: 'b1', tijd: '2026-08-18T09:00:00', schoonmakerId: null });
  const bezoek = haalWeek(doc, 2026, 34).bezoeken[0];
  assert.equal(bezoek.schoonmakerId, null);
  assert.equal(schoonmakerNaam(doc, null), null);
});

test('schoonmaaksters opnieuw afspelen levert geen dubbelen op', () => {
  const bewerkingen = [
    { soort: 'schoonmaker.maak', id: 's1', naam: 'Anna' },
    { soort: 'schoonmaker.maak', id: 's2', naam: 'Fatima' },
    { soort: 'instelling.zet', sleutel: 'standaardSchoonmaker', waarde: 's2' },
    { soort: 'bezoek.start', week: W34, id: 'b1', tijd: 't', schoonmakerId: 's2' },
  ];
  const eenmaal = speelAf(leegDocument(), bewerkingen);
  assert.deepEqual(speelAf(eenmaal, bewerkingen), eenmaal);
});

test('schoonmaaksters herordenen werkt', () => {
  let doc = pasToe(leegDocument(), { soort: 'schoonmaker.maak', id: 's1', naam: 'Anna' });
  doc = pasToe(doc, { soort: 'schoonmaker.maak', id: 's2', naam: 'Fatima' });
  doc = pasToe(doc, { soort: 'schoonmaker.volgorde', ids: ['s2', 's1'] });
  assert.deepEqual(schoonmakerLijst(doc).map((s) => s.naam), ['Fatima', 'Anna']);
});

test('de kop toont de dag van vandaag, niet de maandag van de week', async () => {
  const { weekTitel } = await import('../app/js/util.js');
  assert.equal(weekTitel({ weeknummer: 35 }, new Date(2026, 7, 26)), 'Week 35 — woensdag 26 augustus');
  assert.equal(weekTitel({ weeknummer: 35 }, new Date(2026, 7, 28)), 'Week 35 — vrijdag 28 augustus');
});

/* -------------------------------------------------------- historie wissen --- */

test('historie wissen laat de bibliotheek staan', async () => {
  const { maakTestDocument } = await import('../app/js/testdata.js');
  const { historieOmvang } = await import('../app/js/document.js');
  let doc = maakTestDocument();

  const voor = historieOmvang(doc);
  assert.ok(voor.aantalWeken > 0 && voor.aantalBezoeken > 0 && voor.aantalBerichten > 0);

  doc = pasToe(doc, { soort: 'historie.wis', weken: voor.weken, berichten: voor.berichten });

  const na = historieOmvang(doc);
  assert.equal(na.aantalWeken, 0);
  assert.equal(na.aantalAfgevinkt, 0);
  assert.equal(na.aantalBezoeken, 0);
  assert.equal(na.aantalBerichten, 0);

  assert.ok(doc.taken.length >= 25, 'taken blijven');
  assert.ok(doc.ruimtes.length >= 8, 'ruimtes blijven');
  assert.equal(doc.schoonmakers.length, 2, 'schoonmaaksters blijven');
  assert.ok(doc.instellingen.standaardSchoonmaker, 'de standaard blijft');
});

test('wissen raakt alleen wat er op dat moment was', () => {
  // Belangrijk: opnieuw afspelen mag geen weken wissen die er later bij kwamen.
  let doc = leegDocument();
  doc = pasToe(doc, { soort: 'week.notitie', week: W33, notitie: 'oud' });
  const omvang = { weken: [W33], berichten: [] };

  doc = pasToe(doc, { soort: 'week.notitie', week: W34, notitie: 'nieuw' });
  doc = pasToe(doc, { soort: 'historie.wis', ...omvang });

  assert.equal(doc.weken[W33], undefined, 'de oude week is weg');
  assert.equal(doc.weken[W34].notitie, 'nieuw', 'de nieuwe week blijft');

  // En nog eens afspelen verandert niets meer.
  assert.deepEqual(pasToe(doc, { soort: 'historie.wis', ...omvang }), doc);
});

test('historieOmvang telt wat er weggaat', () => {
  let doc = maakVoorbeeldDocument();
  const taakId = doc.taken.find((t) => t.type === 'wekelijks').id;
  doc = metWeek(doc, W34, [taakId]);
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W34, taakId, afgevinkt: true, tijd: 't' });
  doc = pasToe(doc, { soort: 'weektaak.opmerking', week: W34, taakId, opmerking: 'lekt' });
  doc = pasToe(doc, { soort: 'bezoek.start', week: W34, id: 'b1', tijd: 't' });
  doc = pasToe(doc, {
    soort: 'bericht.maak',
    bericht: { id: 'm1', week: W34, afzender: 'schoonmaakster', tekst: 'hoi', aangemaaktOp: 't', gelezen: false },
  });

  const omvang = historieOmvang(doc);
  assert.equal(omvang.aantalWeken, 1);
  assert.equal(omvang.aantalAfgevinkt, 1);
  assert.equal(omvang.aantalOpmerkingen, 1);
  assert.equal(omvang.aantalBezoeken, 1);
  assert.equal(omvang.aantalBerichten, 1);
});

/* ------------------------------------------- herinneren en vanzelf stoppen --- */

const START = '2026-08-26T08:00:00';
const naUur = (u) => new Date(new Date(START).getTime() + u * 3600000);

function metLopendBezoek() {
  return pasToe(leegDocument(), { soort: 'bezoek.start', week: W34, id: 'bz', tijd: START });
}

test('het alarm komt na drie uur, daarna elk half uur', () => {
  const bezoek = haalWeek(metLopendBezoek(), 2026, 34).bezoeken[0];
  assert.equal(herinneringNummer(bezoek, naUur(1)), null);
  assert.equal(herinneringNummer(bezoek, naUur(2.9)), null, 'net voor drie uur nog niet');
  assert.equal(herinneringNummer(bezoek, naUur(3)), 1);
  assert.equal(herinneringNummer(bezoek, naUur(3.4)), 1, 'binnen het half uur dezelfde');
  assert.equal(herinneringNummer(bezoek, naUur(3.5)), 2);
  assert.equal(herinneringNummer(bezoek, naUur(4)), 3);
});

test('een afgesloten bezoek herinnert nergens meer aan', () => {
  let doc = metLopendBezoek();
  doc = pasToe(doc, { soort: 'bezoek.stop', week: W34, id: 'bz', tijd: naUur(1).toISOString() });
  assert.equal(herinneringNummer(haalWeek(doc, 2026, 34).bezoeken[0], naUur(9)), null);
});

test('na vier uur sluit de app het bezoek zelf af', () => {
  let doc = metLopendBezoek();
  assert.deepEqual(autoStopBewerkingen(doc, naUur(3.9)), [], 'daarvoor gebeurt er niets');

  const bewerkingen = autoStopBewerkingen(doc, naUur(4.1));
  assert.equal(bewerkingen.length, 1);
  doc = speelAf(doc, bewerkingen);

  const bezoek = haalWeek(doc, 2026, 34).bezoeken[0];
  assert.equal(bezoek.gestoptOp, naUur(4).toISOString(), 'precies op de grens, niet op "nu"');
  assert.equal(bezoek.automatisch, true);
  assert.equal(gewerkteMinuten(haalWeek(doc, 2026, 34), naUur(9)), 240);
});

test('de app stopt nooit vóór het alarm, ook niet bij een rare instelling', () => {
  let doc = metLopendBezoek();
  doc = pasToe(doc, { soort: 'instelling.zet', sleutel: 'herinnerNa', waarde: 240 });
  doc = pasToe(doc, { soort: 'instelling.zet', sleutel: 'stopNa', waarde: 120 });
  assert.equal(werktijden(doc).stopNa, 240, 'stopNa wordt opgetrokken naar het alarm');
  assert.deepEqual(autoStopBewerkingen(doc, naUur(3)), [], 'dus niet al na twee uur afgesloten');
});

test('de eindtijd komt uit de starttijd, dus elk apparaat rekent hetzelfde uit', () => {
  const doc = metLopendBezoek();
  const telefoon = autoStopBewerkingen(doc, naUur(5.2));
  const laptop = autoStopBewerkingen(doc, naUur(7.8));
  assert.deepEqual(telefoon, laptop, 'wie het als eerste opent maakt niet uit');
});

test('vanzelf afsluiten is veilig om opnieuw af te spelen', () => {
  const doc = metLopendBezoek();
  const bewerkingen = autoStopBewerkingen(doc, naUur(6));
  const eenmaal = speelAf(doc, bewerkingen);
  assert.deepEqual(speelAf(eenmaal, bewerkingen), eenmaal);
  assert.deepEqual(autoStopBewerkingen(eenmaal, naUur(9)), [], 'en er komt niets bij');
});

test('een vanzelf afgesloten bezoek is als zodanig herkenbaar', () => {
  let doc = metLopendBezoek();
  doc = speelAf(doc, autoStopBewerkingen(doc, naUur(6)));
  const week = haalWeek(doc, 2026, 34);
  assert.equal(automatischGestopteBezoeken(week).length, 1);

  // Zelf op "klaar" tikken levert geen markering op.
  let netjes = metLopendBezoek();
  netjes = pasToe(netjes, { soort: 'bezoek.stop', week: W34, id: 'bz', tijd: naUur(2).toISOString() });
  assert.equal(automatischGestopteBezoeken(haalWeek(netjes, 2026, 34)).length, 0);
});

test('de tijden zijn per huishouden aan te passen', () => {
  let doc = metLopendBezoek();
  doc = pasToe(doc, { soort: 'instelling.zet', sleutel: 'stopNa', waarde: 120 });
  doc = pasToe(doc, { soort: 'instelling.zet', sleutel: 'herinnerNa', waarde: 60 });

  assert.equal(werktijden(doc).stopNa, 120);
  const bezoek = haalWeek(doc, 2026, 34).bezoeken[0];
  assert.equal(herinneringNummer(bezoek, naUur(1), werktijden(doc)), 1, 'nu al na een uur');
  assert.equal(autoStopBewerkingen(doc, naUur(2.5)).length, 1, 'en na twee uur dicht');
});

test('bezoekMinuten begrenst één bezoek', () => {
  const bezoek = { gestartOp: START, gestoptOp: null };
  assert.equal(Math.round(bezoekMinuten(bezoek, naUur(2))), 120);
  assert.equal(Math.round(bezoekMinuten(bezoek, naUur(8))), WERKTIJD.stopNa);
  assert.equal(bezoekMinuten({ gestartOp: null }, naUur(2)), 0);
});

/* ------------------------------------------------- tijd en prioriteit ---- */

test('de begroting scheidt wat moet van wat mag blijven liggen', () => {
  const taken = [
    { id: 'a', geschatteMinuten: 60 },
    { id: 'b', geschatteMinuten: 90 },
    { id: 'c', geschatteMinuten: 40, magWachten: true },
  ];
  const b = tijdBegroting(taken, 180);
  assert.equal(b.moetMinuten, 150);
  assert.equal(b.wachtMinuten, 40);
  assert.equal(b.totaalMinuten, 190);
  assert.equal(b.aantalMoet, 2);
  assert.equal(b.over, 10, 'tien minuten boven de beoogde werktijd');
  assert.equal(b.moetOver, -30, 'maar wat moet past er ruim in');
});

test('taken zonder geschatte tijd tellen gewoon als nul', () => {
  const b = tijdBegroting([{ id: 'a' }, { id: 'b', geschatteMinuten: 20 }], 180);
  assert.equal(b.totaalMinuten, 20);
  assert.equal(b.over, -160);
});

test('een lege week begroot op nul', () => {
  assert.deepEqual(tijdBegroting([], 180), {
    budget: 180, moetMinuten: 0, wachtMinuten: 0, totaalMinuten: 0,
    aantalMoet: 0, aantalWacht: 0, over: -180, moetOver: -180,
  });
});

test('de samensteller rekent de begroting van de gekozen taken uit', () => {
  let doc = maakVoorbeeldDocument();
  const wekelijks = doc.taken.filter((t) => t.type === 'wekelijks');
  const minuten = wekelijks.reduce((som, t) => som + (t.geschatteMinuten || 0), 0);
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: wekelijks.map((t) => t.id), bekend: doc.taken.map((t) => t.id) });

  const sam = weekSamensteller(doc, 2026, 34);
  assert.equal(sam.begroting.budget, 180, 'drie uur, zolang niemand het aanpast');
  assert.equal(sam.begroting.totaalMinuten, minuten);
  assert.ok(sam.begroting.over > 0, 'alle wekelijkse taken passen niet in drie uur');

  // Eén taak mag blijven liggen: het totaal verandert niet, de verdeling wel.
  doc = pasToe(doc, { soort: 'taak.bewerk', id: wekelijks[0].id, velden: { magWachten: true } });
  const na = weekSamensteller(doc, 2026, 34).begroting;
  assert.equal(na.totaalMinuten, minuten);
  assert.equal(na.wachtMinuten, wekelijks[0].geschatteMinuten);
  assert.equal(na.moetMinuten, minuten - wekelijks[0].geschatteMinuten);
});

test('het alarm weet wat er nog moet en wat kan blijven liggen', () => {
  let doc = maakVoorbeeldDocument();
  const [een, twee, drie] = doc.taken.filter((t) => t.type === 'wekelijks');
  doc = pasToe(doc, { soort: 'taak.bewerk', id: drie.id, velden: { magWachten: true } });
  doc = pasToe(doc, {
    soort: 'week.taken', week: W34,
    taakIds: [een.id, twee.id, drie.id], bekend: doc.taken.map((t) => t.id),
  });
  doc = pasToe(doc, { soort: 'weektaak.afvinken', week: W34, taakId: een.id, afgevinkt: true, tijd: 't' });

  const open = watStaatNogOpen(weekOverzicht(doc, 2026, 34));
  assert.deepEqual(open.moet.map((r) => r.taakId), [twee.id], 'de afgevinkte telt niet meer mee');
  assert.deepEqual(open.magWachten.map((r) => r.taakId), [drie.id]);
});

test('de prioriteit komt mee in haar weeklijst', () => {
  let doc = maakVoorbeeldDocument();
  const taak = doc.taken.find((t) => t.type === 'wekelijks');
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: [taak.id], bekend: doc.taken.map((t) => t.id) });
  assert.equal(weekOverzicht(doc, 2026, 34).regels[0].magWachten, false, 'standaard moet alles');

  doc = pasToe(doc, { soort: 'taak.bewerk', id: taak.id, velden: { magWachten: true } });
  assert.equal(weekOverzicht(doc, 2026, 34).regels[0].magWachten, true);
});

test('de historie toont naast de gewerkte ook de geplande tijd', () => {
  let doc = maakVoorbeeldDocument();
  const taken = doc.taken.filter((t) => t.type === 'wekelijks').slice(0, 3);
  const minuten = taken.reduce((som, t) => som + (t.geschatteMinuten || 0), 0);
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: taken.map((t) => t.id), bekend: doc.taken.map((t) => t.id) });

  const w = historie(doc).find((x) => x.weeknummer === 34);
  assert.equal(w.geplandeMinuten, minuten);
});

/* ------------------------------------------------------------ het gesprek -- */

test('het gesprek zet berichten en opmerkingen op volgorde van de tijd', () => {
  let doc = maakVoorbeeldDocument();
  const taak = doc.taken.find((t) => t.type === 'wekelijks');
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: [taak.id], bekend: doc.taken.map((t) => t.id) });

  doc = pasToe(doc, {
    soort: 'bericht.maak',
    bericht: { id: 'b1', week: W34, afzender: 'beheerder', tekst: 'Tot dinsdag', aangemaaktOp: '2026-08-17T09:00:00.000Z', gelezen: false },
  });
  doc = pasToe(doc, {
    soort: 'weektaak.opmerking', week: W34, taakId: taak.id,
    opmerking: 'De kraan lekt', tijd: '2026-08-18T10:00:00.000Z',
  });
  doc = pasToe(doc, {
    soort: 'bericht.maak',
    bericht: { id: 'b2', week: W34, afzender: 'schoonmaakster', tekst: 'Zeep is op', aangemaaktOp: '2026-08-19T11:00:00.000Z', gelezen: false },
  });

  const regels = gesprek(doc);
  assert.deepEqual(regels.map((r) => r.tekst), ['Tot dinsdag', 'De kraan lekt', 'Zeep is op'], 'oudste eerst');
  assert.deepEqual(regels.map((r) => r.afzender), ['beheerder', 'schoonmaakster', 'schoonmaakster']);
  assert.equal(regels[1].soort, 'opmerking');
  assert.equal(regels[1].taakTitel, taak.titel);
});

test('het gesprek houdt berichten van alle weken vast', () => {
  let doc = maakVoorbeeldDocument();
  for (const [i, week] of [W33, W34].entries()) {
    doc = pasToe(doc, {
      soort: 'bericht.maak',
      bericht: { id: `b${i}`, week, afzender: 'beheerder', tekst: `week ${i}`, aangemaaktOp: `2026-08-1${i}T09:00:00.000Z`, gelezen: false },
    });
  }
  assert.equal(gesprek(doc).length, 2, 'niet alleen de huidige week');
});

test('een opmerking zonder tijdstip valt terug op de week', () => {
  // Opmerkingen van vóór deze versie hebben geen tijdstip; die horen toch op
  // de juiste plek in de tijd te staan en niet bovenaan of onderaan te plakken.
  let doc = maakVoorbeeldDocument();
  const taak = doc.taken.find((t) => t.type === 'wekelijks');
  doc = pasToe(doc, { soort: 'week.taken', week: W33, taakIds: [taak.id], bekend: doc.taken.map((t) => t.id) });
  doc = pasToe(doc, { soort: 'weektaak.opmerking', week: W33, taakId: taak.id, opmerking: 'oud' });

  const [regel] = gesprek(doc);
  assert.ok(regel.op.startsWith(doc.weken[W33].startdatum), regel.op);
});

test('een opmerking wissen haalt hem uit het gesprek', () => {
  let doc = maakVoorbeeldDocument();
  const taak = doc.taken.find((t) => t.type === 'wekelijks');
  doc = pasToe(doc, { soort: 'week.taken', week: W34, taakIds: [taak.id], bekend: doc.taken.map((t) => t.id) });
  doc = pasToe(doc, { soort: 'weektaak.opmerking', week: W34, taakId: taak.id, opmerking: 'iets', tijd: 't1' });
  assert.equal(gesprek(doc).length, 1);

  doc = pasToe(doc, { soort: 'weektaak.opmerking', week: W34, taakId: taak.id, opmerking: '', tijd: 't2' });
  assert.equal(gesprek(doc).length, 0);
  assert.equal(doc.weken[W34].taken[taak.id].opmerkingOp, null, 'en het tijdstip gaat mee weg');
});

test('zij heeft een telletje voor wat van thuis komt', () => {
  let doc = maakVoorbeeldDocument();
  doc = pasToe(doc, {
    soort: 'bericht.maak',
    bericht: { id: 'b1', week: W34, afzender: 'beheerder', tekst: 'hoi', aangemaaktOp: 't', gelezen: false },
  });
  doc = pasToe(doc, {
    soort: 'bericht.maak',
    bericht: { id: 'b2', week: W34, afzender: 'schoonmaakster', tekst: 'eigen bericht', aangemaaktOp: 't', gelezen: false },
  });
  assert.equal(aantalOngelezen(doc, 'schoonmaakster'), 1, 'haar eigen bericht telt niet mee');

  doc = pasToe(doc, { soort: 'berichten.allesGelezen', afzender: 'beheerder' });
  assert.equal(aantalOngelezen(doc, 'schoonmaakster'), 0);
  assert.equal(aantalOngelezen(doc, 'beheerder'), 1, 'en die van haar staat nog open bij jou');
});
