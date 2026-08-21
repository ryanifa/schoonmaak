import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tijdelijk = fs.mkdtempSync(path.join(os.tmpdir(), 'schoonmaak-test-'));
process.env.DATA_DIR = tijdelijk;
process.env.BEHEER_TOKEN = 'test-beheer';
process.env.SCHOONMAAK_TOKEN = 'test-schoon';

const { ruimtes, taken, weken, weektaken, berichten, weekOverzicht, weekSamensteller } = await import('../src/repo.js');
const { seedIndienLeeg } = await import('../src/seed.js');

before(() => { seedIndienLeeg(); });
after(() => { fs.rmSync(tijdelijk, { recursive: true, force: true }); });

test('de voorbeeldbibliotheek is gevuld', () => {
  assert.ok(ruimtes.lijst().length >= 8);
  assert.ok(taken.lijst().length >= 40);
  assert.ok(taken.lijst().every((t) => t.titel && t.ruimteNaam && t.standaardFrequentie));
});

test('seeden gebeurt maar één keer', () => {
  const voor = taken.lijst().length;
  assert.equal(seedIndienLeeg(), false);
  assert.equal(taken.lijst().length, voor);
});

test('taken zijn gesorteerd op ruimte en daarna op volgorde', () => {
  const lijst = taken.lijst();
  const ruimteVolgorde = ruimtes.lijst().map((r) => r.id);
  let vorigeRuimteIndex = -1;
  let vorigeVolgorde = -1;
  for (const taak of lijst) {
    const index = ruimteVolgorde.indexOf(taak.ruimteId);
    assert.ok(index >= vorigeRuimteIndex);
    if (index > vorigeRuimteIndex) { vorigeRuimteIndex = index; vorigeVolgorde = -1; }
    assert.ok(taak.volgorde >= vorigeVolgorde);
    vorigeVolgorde = taak.volgorde;
  }
});

test('een taak archiveren haalt hem uit de actieve lijst maar bewaart hem', () => {
  const taak = taken.lijst()[0];
  taken.bewerk(taak.id, { actief: false });
  assert.ok(!taken.lijst().some((t) => t.id === taak.id));
  assert.ok(taken.lijst({ inclusiefGearchiveerd: true }).some((t) => t.id === taak.id));
  taken.bewerk(taak.id, { actief: true });
});

test('een week samenstellen en afvinken', () => {
  const week = weken.haalOfMaak(2026, 20);
  const gekozen = taken.lijst().slice(0, 5).map((t) => t.id);
  weken.zetTaken(week.id, gekozen);

  const overzicht = weekOverzicht(2026, 20);
  assert.equal(overzicht.voortgang.totaal, 5);
  assert.equal(overzicht.voortgang.gedaan, 0);

  const eerste = overzicht.taken[0];
  weektaken.zetAfgevinkt(eerste.id, true);
  const na = weekOverzicht(2026, 20);
  assert.equal(na.voortgang.gedaan, 1);
  assert.ok(na.taken[0].afgevinktOp, 'een tijdstempel wordt vastgelegd');

  weektaken.zetAfgevinkt(eerste.id, false);
  assert.equal(weekOverzicht(2026, 20).taken[0].afgevinktOp, null);
});

test('de weeklijst aanpassen behoudt bestaande afvinkjes', () => {
  const week = weken.haalOfMaak(2026, 21);
  const ids = taken.lijst().slice(0, 4).map((t) => t.id);
  weken.zetTaken(week.id, ids);
  const weektaak = weken.taken(week.id)[0];
  weektaken.zetAfgevinkt(weektaak.id, true);

  weken.zetTaken(week.id, [...ids, taken.lijst()[9].id]);
  const na = weken.taken(week.id);
  assert.equal(na.length, 5);
  assert.ok(na.find((t) => t.taakId === weektaak.taakId).afgevinkt, 'afvinkje blijft staan');
});

test('vorige week kopiëren neemt de taken maar niet de afvinkjes over', () => {
  const bron = weken.haalOfMaak(2026, 30);
  weken.zetTaken(bron.id, taken.lijst().slice(0, 6).map((t) => t.id));
  weektaken.zetAfgevinkt(weken.taken(bron.id)[0].id, true);

  const doel = weken.haalOfMaak(2026, 31);
  const resultaat = weken.kopieerVorigeWeek(doel.id);
  assert.equal(resultaat.gekopieerd, 6);
  assert.ok(weken.taken(doel.id).every((t) => !t.afgevinkt));
});

test('wekenGeleden laat zien hoe lang een taak niet gedaan is', () => {
  const week = weken.haalOfMaak(2026, 10);
  const taak = taken.lijst()[3];
  weken.zetTaken(week.id, [taak.id]);
  weektaken.zetAfgevinkt(weken.taken(week.id)[0].id, true);

  const vijfWekenLater = weekSamensteller(2026, 15);
  const info = vijfWekenLater.groepen.flatMap((g) => g.taken).find((t) => t.id === taak.id);
  assert.equal(info.wekenGeleden, 5);

  // Een week vóór het afvinken telt niet mee.
  const eerder = weekSamensteller(2026, 9);
  const infoEerder = eerder.groepen.flatMap((g) => g.taken).find((t) => t.id === taak.id);
  assert.equal(infoEerder.wekenGeleden, null);
});

test('opnieuw versturen van hetzelfde bericht levert geen duplicaat op', () => {
  const week = weken.haalOfMaak(2026, 22);
  const a = berichten.maak({ weekId: week.id, afzender: 'schoonmaakster', tekst: 'Zeep is op', clientId: 'abc' });
  const b = berichten.maak({ weekId: week.id, afzender: 'schoonmaakster', tekst: 'Zeep is op', clientId: 'abc' });
  assert.equal(a.id, b.id);
  assert.equal(berichten.lijst({ weekId: week.id }).length, 1);
});

test('ongelezen berichten tellen alleen die van de ander', () => {
  const voor = berichten.aantalOngelezen('beheerder');
  berichten.maak({ afzender: 'beheerder', tekst: 'Eigen bericht' });
  assert.equal(berichten.aantalOngelezen('beheerder'), voor);
  berichten.maak({ afzender: 'schoonmaakster', tekst: 'Van de hulp' });
  assert.equal(berichten.aantalOngelezen('beheerder'), voor + 1);
  berichten.markeerAllesGelezen('schoonmaakster');
  assert.equal(berichten.aantalOngelezen('beheerder'), 0);
});

test('een lege week geeft een bruikbaar leeg overzicht', () => {
  const overzicht = weekOverzicht(2030, 5);
  assert.equal(overzicht.week.id, null);
  assert.equal(overzicht.week.startdatum, '2030-01-28');
  assert.deepEqual(overzicht.voortgang, { gedaan: 0, totaal: 0 });
  assert.deepEqual(overzicht.groepen, []);
});

test('ruimtes herordenen werkt door in de takenvolgorde', () => {
  const lijst = ruimtes.lijst();
  const omgedraaid = [...lijst].reverse().map((r) => r.id);
  ruimtes.herorden(omgedraaid);
  assert.deepEqual(ruimtes.lijst().map((r) => r.id), omgedraaid);
  assert.equal(taken.lijst()[0].ruimteId, omgedraaid[0]);
  ruimtes.herorden(lijst.map((r) => r.id));
});
