/* Het alarm bij haar: de tijdbalk, de waarschuwing als de beoogde werktijd om
   is, en wat er dan nog openstaat. */

import { chromium, rapport, laptop, metTestklok, BEHEER, TELEFOON } from './helpers.mjs';

const r = rapport('alarm en tijdbalk');
const browser = await chromium.launch();

/* --- haar kant openen en een taak uitkiezen die nog openstaat --- */
const laptopCtx = await laptop(browser);
const p = r.volg(await laptopCtx.newPage());
await p.setViewportSize({ width: 390, height: 844 });
const klok = await metTestklok(p);
await p.goto(TELEFOON);
await p.waitForSelector('#lijst li.taak');

// Een taak die nog niet afgevinkt is: bij een afgevinkte taak doet de
// prioriteit er niet meer toe, dus die toont het label bewust niet.
const titel = await p.evaluate(() => document
  .querySelector('#lijst li.taak:not(.gedaan) .taak-titel').textContent);

/* --- die in beheer op "mag blijven liggen" zetten. Zelfde context: de
   testmodus bewaart alles in localStorage van deze browser. --- */
const b = r.volg(await laptopCtx.newPage());
await b.setViewportSize({ width: 1100, height: 950 });
await b.goto(BEHEER);
await b.waitForSelector('.taaklijst li');
await b.click('.tab[data-tab=bibliotheek]');
await b.waitForSelector('.taaklijst li');
await b.click(`.taaklijst li:has-text("${titel}") button.taak-rij`);
await b.waitForSelector('.overlay');
await b.check('.aanvink input');
await b.click('.overlay button:has-text("Opslaan")');
await b.waitForTimeout(800);
await b.close();

await p.reload();
await p.waitForSelector('#lijst li.taak');

r.ok('haar lijst markeert wat mag blijven liggen',
  /mag blijven liggen/.test(await p.textContent(`#lijst li:has-text("${titel}")`)), titel);

await p.click('#werk button:has-text("Ik begin")');
// Staan er meerdere schoonmaaksters in, dan kiest ze eerst haar naam.
if (await p.locator('.wie-lijst .knop').count()) await p.click('.wie-lijst .knop');
await p.waitForSelector('#werk .werkblok.bezig');
r.ok('er staat een tijdbalk zodra ze begint', await p.locator('#werk .tijdbalk').count() === 1);
r.ok('die telt af naar de beoogde werktijd', /nog 3 uur tot 3 uur/.test(await p.textContent('#werk .tijdbalk')),
  (await p.textContent('#werk .tijdbalk')).trim());
r.ok('nog geen alarm', await p.locator('#werk .alarm').count() === 0);

await klok.verzet(2);
await p.waitForSelector('#werk .werkblok.bezig');
r.ok('na twee uur nog steeds geen alarm', await p.locator('#werk .alarm').count() === 0);
r.ok('maar de balk staat wel verder', /nog 1 uur tot 3 uur/.test(await p.textContent('#werk .tijdbalk')),
  (await p.textContent('#werk .tijdbalk')).trim());

await klok.verzet(3.2);
await p.waitForSelector('#werk .alarm');
const alarm = await p.textContent('#werk .alarm');
r.ok('na drie uur gaat het alarm af', /De 3 uur is om/.test(alarm));
r.ok('het alarm noemt wat er nog moet', /Dit moet nog/.test(alarm),
  alarm.replace(/\s+/g, ' ').slice(0, 90));
r.ok('en wat er mag blijven liggen', /Dit mag blijven liggen/.test(alarm) && alarm.includes(titel));
r.ok('de tijdbalk kleurt om', await p.locator('#werk .tijdbalk.over').count() === 1,
  (await p.textContent('#werk .tijdbalk')).trim());
await p.screenshot({ path: process.env.SP ? `${process.env.SP}/alarm.png` : 'alarm.png' });

await p.click('#werk button:has-text("Nog even door")');
await p.waitForTimeout(300);
r.ok('"Nog even door" laat het alarm verdwijnen', await p.locator('#werk .alarm').count() === 0);
r.ok('maar de tijdbalk blijft rood', await p.locator('#werk .tijdbalk.over').count() === 1);

await klok.verzet(3.6);
await p.waitForSelector('#werk .alarm');
r.ok('een half uur later komt het alarm terug', /Je bent nu 3 uur 3\d bezig/.test(await p.textContent('#werk .alarm')),
  (await p.textContent('#werk .alarm .hulp')).trim());

await klok.verzet(4.2);
await p.waitForSelector('#werk .werkblok');
r.ok('na vier uur is het bezoek vanzelf afgesloten', await p.locator('#werk .werkblok.bezig').count() === 0);
r.ok('en is de tijd afgekapt op vier uur', /4 uur/.test(await p.textContent('#werk .klok')),
  (await p.textContent('#werk .klok')).trim());

await browser.close();
process.exit(r.afsluiten() ? 1 : 0);
