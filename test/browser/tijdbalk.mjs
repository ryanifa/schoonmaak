/* De tijdbalk in het beheerscherm: zie je tijdens het samenstellen dat de
   weeklijst niet in de beoogde werktijd past? */

import { chromium, rapport, laptop, BEHEER } from './helpers.mjs';

const r = rapport('tijdbalk in beheer');
const browser = await chromium.launch();
const ctx = await laptop(browser);
const b = r.volg(await ctx.newPage());
await b.goto(BEHEER);
await b.waitForSelector('.taaklijst li');
/* --- de tijdbalk in het beheerscherm --- */
r.ok('er staat een tijdbalk', await b.locator('.begroting').count() === 1);
const kop = await b.textContent('.begroting-kop');
r.ok('hij noemt gepland en beoogd', /van 3 uur/.test(kop), kop.trim());
r.ok('en de uitleg splitst moet van mag-wachten',
  /moet deze week af/.test(await b.textContent('.begroting')) && /mag blijven liggen/.test(await b.textContent('.begroting')),
  (await b.textContent('.begroting')).replace(/\s+/g, ' ').slice(0, 110));
r.ok('per ruimte staat er een subtotaal',
  /\d\/\d · /.test(await b.textContent('.ruimte-kop .aantal')), await b.textContent('.ruimte-kop .aantal'));

/* --- de teller loopt mee bij aanvinken --- */
const totaal = () => b.textContent('.begroting-kop strong');
const voor = await totaal();
await b.evaluate(() => document.querySelector('.taaklijst li.gekozen button.taak-rij').click());
await b.waitForTimeout(400);
r.ok('de teller loopt mee bij uitvinken', (await totaal()) !== voor, `${voor.trim()} -> ${(await totaal()).trim()}`);

/* --- te veel ingepland wordt rood --- */
await b.click('button:has-text("Alles wekelijks aanzetten")');
await b.waitForTimeout(900);
r.ok('alle wekelijkse taken passen niet in 3 uur', await b.locator('.begroting.te-veel').count() === 1,
  (await b.textContent('.begroting-kop')).trim());
r.ok('en de app zegt hoeveel te veel', /te veel/.test(await b.textContent('.begroting')),
  (await b.textContent('.begroting .klein:last-child')).trim());
await b.screenshot({ path: process.env.SP ? `${process.env.SP}/tijdbalk.png` : 'tijdbalk.png' });

/* --- een taak op "mag blijven liggen" zetten --- */
const titel = await b.textContent('.taaklijst li.gekozen .taak-titel');
await b.click('.tab[data-tab=bibliotheek]');
await b.waitForSelector('.taaklijst li');
await b.click(`.taaklijst li:has-text("${titel}") button.taak-rij`);
await b.waitForSelector('.overlay');
r.ok('het formulier heeft een vinkje voor prioriteit', await b.locator('.aanvink input').count() === 1);
await b.check('.aanvink input');
await b.click('.overlay button:has-text("Opslaan")');
await b.waitForTimeout(900);
r.ok('de bibliotheek toont het label',
  /mag blijven liggen/.test(await b.textContent(`.taaklijst li:has-text("${titel}")`)));
await b.click('.tab[data-tab=week]');
await b.waitForSelector('.begroting');
r.ok('de begroting verschuift naar de buffer',
  /mag blijven liggen/.test(await b.textContent('.begroting')),
  (await b.textContent('.begroting .klein')).replace(/\s+/g, ' ').trim());

/* --- de werktijd is in te stellen --- */
await b.click('.tab[data-tab=bibliotheek]');
await b.waitForSelector('.taaklijst li');
await b.click('button:has-text("Werktijd")');
await b.waitForSelector('.overlay');
await b.fill('.overlay input[type=number]', '150');
await b.click('.overlay button:has-text("Opslaan")');
await b.waitForTimeout(900);
await b.click('.tab[data-tab=week]');
await b.waitForSelector('.begroting');
r.ok('de beoogde werktijd is aan te passen', /van 2 uur 30/.test(await b.textContent('.begroting-kop')),
  (await b.textContent('.begroting-kop')).trim());

// terug naar drie uur voor de rest van de test
await b.click('.tab[data-tab=bibliotheek]');
await b.waitForSelector('.taaklijst li');
await b.click('button:has-text("Werktijd")');
await b.waitForSelector('.overlay');
await b.fill('.overlay input[type=number]', '180');
await b.click('.overlay button:has-text("Opslaan")');
await b.waitForTimeout(900);

await browser.close();
process.exit(r.afsluiten() ? 1 : 0);
