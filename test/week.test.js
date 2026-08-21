import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isoWeek, startdatumVanWeek, alsDatumTekst, wekenInJaar,
  vorigeWeek, volgendeWeek, wekenTussen, maandagVan,
} from '../src/util/week.js';

const d = (tekst) => {
  const [j, m, dag] = tekst.split('-').map(Number);
  return new Date(j, m - 1, dag);
};

test('isoWeek volgt de ISO-8601-regels', () => {
  assert.deepEqual(isoWeek(d('2026-01-01')), { jaar: 2026, weeknummer: 1 });
  assert.deepEqual(isoWeek(d('2021-01-01')), { jaar: 2020, weeknummer: 53 });
  assert.deepEqual(isoWeek(d('2024-12-30')), { jaar: 2025, weeknummer: 1 });
  assert.deepEqual(isoWeek(d('2019-12-31')), { jaar: 2020, weeknummer: 1 });
  assert.deepEqual(isoWeek(d('2026-08-21')), { jaar: 2026, weeknummer: 34 });
});

test('een week begint op maandag', () => {
  for (const dag of ['2026-08-17', '2026-08-19', '2026-08-23']) {
    assert.equal(alsDatumTekst(maandagVan(d(dag))), '2026-08-17');
  }
});

test('startdatumVanWeek is de omgekeerde van isoWeek', () => {
  for (const jaar of [2019, 2020, 2021, 2024, 2025, 2026]) {
    for (let w = 1; w <= wekenInJaar(jaar); w++) {
      const start = startdatumVanWeek(jaar, w);
      assert.deepEqual(isoWeek(start), { jaar, weeknummer: w }, `${jaar}-W${w}`);
      assert.equal(start.getDay(), 1, 'moet een maandag zijn');
    }
  }
});

test('jaren met 53 weken', () => {
  assert.equal(wekenInJaar(2020), 53);
  assert.equal(wekenInJaar(2026), 53);
  assert.equal(wekenInJaar(2025), 52);
});

test('vorige en volgende week springen over de jaargrens', () => {
  assert.deepEqual(vorigeWeek(2021, 1), { jaar: 2020, weeknummer: 53 });
  assert.deepEqual(volgendeWeek(2020, 53), { jaar: 2021, weeknummer: 1 });
  assert.deepEqual(vorigeWeek(2026, 12), { jaar: 2026, weeknummer: 11 });
});

test('wekenTussen telt hele weken', () => {
  assert.equal(wekenTussen('2026-07-13', '2026-08-17'), 5);
  assert.equal(wekenTussen('2026-08-17', '2026-08-17'), 0);
  assert.equal(wekenTussen('2025-12-22', '2026-01-05'), 2);
});
