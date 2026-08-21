import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const POORT = 3999;
const U = `http://127.0.0.1:${POORT}`;
const BEHEER = { 'x-schoonmaak-token': 'b-token', 'content-type': 'application/json' };
const HULP = { 'x-schoonmaak-token': 's-token', 'content-type': 'application/json' };

let server;
let tijdelijk;

async function vraag(koppen, methode, pad, body) {
  const antwoord = await fetch(U + pad, {
    method: methode,
    headers: koppen,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const tekst = await antwoord.text();
  return { status: antwoord.status, data: tekst ? JSON.parse(tekst) : null, headers: antwoord.headers };
}

before(async () => {
  tijdelijk = fs.mkdtempSync(path.join(os.tmpdir(), 'schoonmaak-api-'));
  server = spawn(process.execPath, ['src/server.js'], {
    env: {
      ...process.env,
      DATA_DIR: tijdelijk, PORT: String(POORT),
      BEHEER_TOKEN: 'b-token', SCHOONMAAK_TOKEN: 's-token', PINCODE: '',
    },
    stdio: 'ignore',
  });
  for (let poging = 0; poging < 60; poging++) {
    try {
      await fetch(U + '/');
      return;
    } catch {
      await new Promise((k) => setTimeout(k, 100));
    }
  }
  throw new Error('server startte niet');
});

after(() => {
  server?.kill();
  fs.rmSync(tijdelijk, { recursive: true, force: true });
});

test('zonder geldig token is er geen toegang', async () => {
  assert.equal((await vraag({}, 'GET', '/api/start')).status, 401);
  assert.equal((await vraag({ 'x-schoonmaak-token': 'gokje' }, 'GET', '/api/start')).status, 401);
  assert.equal((await fetch(`${U}/beheer/gokje`)).status, 403);
  assert.equal((await fetch(`${U}/schoonmaak/b-token`)).status, 403, 'beheerlink opent de schoonmaakweergave niet');
});

test('beide rollen krijgen hun eigen rol terug', async () => {
  assert.equal((await vraag(BEHEER, 'GET', '/api/start')).data.rol, 'beheerder');
  assert.equal((await vraag(HULP, 'GET', '/api/start')).data.rol, 'schoonmaakster');
});

test('de schoonmaakweergave geeft geen toegang tot beheerfuncties', async () => {
  for (const [methode, pad, body] of [
    ['GET', '/api/samensteller/2026/34', undefined],
    ['POST', '/api/taken', { titel: 'x', ruimteId: 1 }],
    ['PUT', '/api/taken/1', { titel: 'x' }],
    ['POST', '/api/ruimtes', { naam: 'x' }],
    ['GET', '/api/historie', undefined],
    ['GET', '/api/opmerkingen', undefined],
    ['GET', '/api/taken/1/historie', undefined],
  ]) {
    const r = await vraag(HULP, methode, pad, body);
    assert.equal(r.status, 403, `${methode} ${pad} hoort verboden te zijn`);
  }
  const upload = await fetch(`${U}/api/fotos`, {
    method: 'POST', headers: { 'x-schoonmaak-token': 's-token', 'content-type': 'image/png' }, body: Buffer.from([1, 2, 3]),
  });
  assert.equal(upload.status, 403);
});

test('week samenstellen, afvinken en opmerking plaatsen', async () => {
  const start = (await vraag(BEHEER, 'GET', '/api/start')).data;
  const { jaar, weeknummer } = start.huidigeWeek;

  const sam = (await vraag(BEHEER, 'GET', `/api/samensteller/${jaar}/${weeknummer}`)).data;
  const ids = sam.groepen.flatMap((g) => g.taken).slice(0, 4).map((t) => t.id);
  const gezet = await vraag(BEHEER, 'PUT', `/api/weken/${sam.week.id}/taken`, { taakIds: ids });
  assert.equal(gezet.data.aantalGeselecteerd, 4);

  await vraag(BEHEER, 'PUT', `/api/weken/${sam.week.id}/notitie`, { notitie: 'Let op de vensterbanken.' });

  const week = (await vraag(HULP, 'GET', `/api/week/${jaar}/${weeknummer}`)).data;
  assert.equal(week.week.notitie, 'Let op de vensterbanken.');
  assert.equal(week.voortgang.totaal, 4);

  const weektaakId = week.groepen[0].taken[0].id;
  await vraag(HULP, 'POST', `/api/weektaken/${weektaakId}/afvinken`, { afgevinkt: true });
  await vraag(HULP, 'PUT', `/api/weektaken/${weektaakId}/opmerking`, { opmerking: 'Kraan lekt.' });

  const na = (await vraag(HULP, 'GET', `/api/week/${jaar}/${weeknummer}`)).data;
  assert.equal(na.voortgang.gedaan, 1);
  assert.ok(na.groepen[0].taken[0].afgevinktOp);
  assert.equal(na.groepen[0].taken[0].opmerking, 'Kraan lekt.');

  const opmerkingen = (await vraag(BEHEER, 'GET', '/api/opmerkingen')).data.opmerkingen;
  assert.equal(opmerkingen[0].opmerking, 'Kraan lekt.');
});

test('afvinken is idempotent, zodat opnieuw versturen veilig is', async () => {
  const start = (await vraag(BEHEER, 'GET', '/api/start')).data.huidigeWeek;
  const week = (await vraag(HULP, 'GET', `/api/week/${start.jaar}/${start.weeknummer}`)).data;
  const id = week.groepen[0].taken[0].id;
  const eerste = await vraag(HULP, 'POST', `/api/weektaken/${id}/afvinken`, { afgevinkt: true });
  const tweede = await vraag(HULP, 'POST', `/api/weektaken/${id}/afvinken`, { afgevinkt: true });
  assert.equal(eerste.status, 200);
  assert.equal(tweede.status, 200);
  assert.equal(tweede.data.weektaak.afgevinkt, true);
});

test('een foto uploaden en terugvragen', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const upload = await fetch(`${U}/api/fotos`, {
    method: 'POST', headers: { 'x-schoonmaak-token': 'b-token', 'content-type': 'image/png' }, body: png,
  });
  assert.equal(upload.status, 201);
  const { foto } = await upload.json();

  const zonderToken = await fetch(`${U}/fotos/${foto.id}`);
  assert.equal(zonderToken.status, 401);

  const metToken = await fetch(`${U}/fotos/${foto.id}?t=s-token`);
  assert.equal(metToken.status, 200);
  assert.equal(metToken.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await metToken.arrayBuffer()).length, png.length);

  const verkeerdFormaat = await fetch(`${U}/api/fotos`, {
    method: 'POST', headers: { 'x-schoonmaak-token': 'b-token', 'content-type': 'application/pdf' }, body: png,
  });
  assert.equal(verkeerdFormaat.status, 400);
});

test('ongeldige invoer geeft een duidelijke Nederlandse melding', async () => {
  const leeg = await vraag(BEHEER, 'POST', '/api/taken', { titel: '  ', ruimteId: 1 });
  assert.equal(leeg.status, 400);
  assert.match(leeg.data.fout, /leeg/i);

  const onbekend = await vraag(BEHEER, 'POST', '/api/taken', { titel: 'Test', ruimteId: 99999 });
  assert.equal(onbekend.status, 400);

  const weg = await vraag(HULP, 'POST', '/api/weektaken/424242/afvinken', { afgevinkt: true });
  assert.equal(weg.status, 404);

  const rommel = await fetch(`${U}/api/berichten`, {
    method: 'POST', headers: HULP, body: '{niet echt json',
  });
  assert.equal(rommel.status, 400);
});

test('statische bestanden en onbekende paden', async () => {
  assert.equal((await fetch(`${U}/css/app.css`)).status, 200);
  assert.equal((await fetch(`${U}/onbekend`)).status, 404);
  // Geen uitbraak uit de public-map
  for (const pad of ['/../src/config.js', '/%2e%2e/src/config.js', '/..%2fsrc%2fconfig.js']) {
    const r = await fetch(U + pad);
    const inhoud = await r.text();
    assert.ok(!inhoud.includes('beheerToken'), `${pad} mag geen broncode teruggeven`);
  }
});

test('met een ingestelde pincode is die verplicht', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'schoonmaak-pin-'));
  const poort = 3998;
  const proces = spawn(process.execPath, ['src/server.js'], {
    env: {
      ...process.env,
      DATA_DIR: map, PORT: String(poort),
      BEHEER_TOKEN: 'b-token', SCHOONMAAK_TOKEN: 's-token', PINCODE: '4821',
    },
    stdio: 'ignore',
  });
  const basis = `http://127.0.0.1:${poort}`;
  try {
    for (let poging = 0; poging < 60; poging++) {
      try { await fetch(basis + '/'); break; } catch { await new Promise((k) => setTimeout(k, 100)); }
    }
    const zonder = await fetch(`${basis}/api/start`, { headers: { 'x-schoonmaak-token': 's-token' } });
    const startData = await zonder.json();
    assert.equal(zonder.status, 200, '/api/start blijft bereikbaar om te weten dát er een pin nodig is');
    assert.equal(startData.pinNodig, true);

    const geblokkeerd = await fetch(`${basis}/api/week/2026/34`, { headers: { 'x-schoonmaak-token': 's-token' } });
    assert.equal(geblokkeerd.status, 401);

    const verkeerd = await fetch(`${basis}/api/week/2026/34`, { headers: { 'x-schoonmaak-token': 's-token', 'x-pincode': '0000' } });
    assert.equal(verkeerd.status, 401);

    const goed = await fetch(`${basis}/api/week/2026/34`, { headers: { 'x-schoonmaak-token': 's-token', 'x-pincode': '4821' } });
    assert.equal(goed.status, 200);
  } finally {
    proces.kill();
    fs.rmSync(map, { recursive: true, force: true });
  }
});
