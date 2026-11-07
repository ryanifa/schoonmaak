/* Wat zij van de ingeschatte tijd ziet: per taak, en hoeveel werk er nog ligt. */

import { chromium, rapport, laptop, TELEFOON } from './helpers.mjs';

const r = rapport('tijd bij de schoonmaakster');
const browser = await chromium.launch();
const ctx = await laptop(browser);
const p = r.volg(await ctx.newPage());
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(TELEFOON);
await p.waitForSelector('#lijst li.taak');

/* --- per taak --- */
const metTijd = await p.locator('#lijst li.taak:not(.gedaan) .label.stil').filter({ hasText: 'min' }).count();
r.ok('op openstaande taken staat een geschatte tijd', metTijd > 0, `${metTijd} rijen`);
r.ok('het is als schatting geschreven', /± \d+ min/.test(await p.textContent('#lijst')),
  (await p.locator('#lijst .label.stil').filter({ hasText: 'min' }).first().textContent()).trim());
r.ok('ook bij een opruimtaak',
  /± \d+ min/.test(await p.textContent('#lijst li.taak:has-text("opruimen")')));

/* --- het restant --- */
const rest = await p.textContent('.voortgang-rest');
r.ok('onder de voortgang staat hoeveel werk er nog ligt', /nog \d+ taken · ± /.test(rest), rest.trim());

const getal = (t) => Number(t.match(/nog (\d+) taken/)[1]);
const minuten = (t) => t.match(/± (.+)$/)[1];
const voor = await p.textContent('.voortgang-rest');

/* --- en het loopt mee met afvinken --- */
await p.click('#lijst li.taak:not(.gedaan) button.taak-rij');
await p.waitForTimeout(600);
const na = await p.textContent('.voortgang-rest');
r.ok('afvinken haalt de taak van het restant af', getal(na) === getal(voor) - 1, `${voor.trim()} -> ${na.trim()}`);
r.ok('en de tijd gaat mee omlaag', minuten(na) !== minuten(voor), `${minuten(voor)} -> ${minuten(na)}`);
r.ok('een afgevinkte taak toont zijn schatting niet meer',
  !/± \d+ min/.test(await p.textContent('#lijst li.taak.gedaan')),
  (await p.textContent('#lijst li.taak.gedaan')).replace(/\s+/g, ' ').trim().slice(0, 70));

/* --- geen rommel op het scherm --- */
r.ok('geen losse "null" op de pagina', !/null/.test(await p.textContent('main')));
await p.screenshot({ path: process.env.SP ? `${process.env.SP}/tijd-bij-haar.png` : 'tijd-bij-haar.png' });

await browser.close();
process.exit(r.afsluiten() ? 1 : 0);
