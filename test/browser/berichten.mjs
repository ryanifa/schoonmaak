/* Het berichtenscherm bij haar: alles teruglezen, opmerkingen ertussen, en een
   telletje zodra er iets van thuis komt. */

import { chromium, rapport, laptop, BEHEER, TELEFOON } from './helpers.mjs';

const r = rapport('berichten');
const browser = await chromium.launch();
const ctx = await laptop(browser);

const p = r.volg(await ctx.newPage());
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(TELEFOON);
await p.waitForSelector('#lijst li.taak');

/* --- alles is terug te lezen --- */
await p.click('#bericht-knop');
await p.waitForSelector('.gesprek');
const regels = await p.locator('.gesprek .bericht').count();
r.ok('het gesprek staat er', regels > 0, `${regels} regels`);
r.ok('er staan berichten van thuis bij', await p.locator('.gesprek .van-thuis').count() > 0);
r.ok('en opmerkingen bij taken, met de taak erbij', await p.locator('.gesprek .bij-taak').count() > 0,
  (await p.locator('.gesprek .bij-taak').first().textContent()).trim());
r.ok('het nieuwste staat onderaan', await p.evaluate(() => {
  const g = document.querySelector('.gesprek');
  return g.scrollTop + g.clientHeight >= g.scrollHeight - 4;
}));

/* --- zelf iets sturen --- */
await p.fill('.overlay textarea', 'De stofzuigerzak is vol');
await p.click('.overlay button:has-text("Versturen")');
await p.waitForTimeout(700);
await p.click('#bericht-knop');
await p.waitForSelector('.gesprek');
const laatste = await p.locator('.gesprek .bericht').last().textContent();
r.ok('een nieuw bericht komt onderaan te staan', /stofzuigerzak is vol/.test(laatste), laatste.trim().slice(0, 60));
r.ok('en staat aan haar kant', await p.locator('.gesprek .van-jou').last().textContent()
  .then((t) => /stofzuigerzak/.test(t)));
await p.click('.overlay button:has-text("Sluiten")');

/* --- een opmerking bij een taak komt in het gesprek --- */
await p.click('#lijst li.taak:not(.gedaan) button:has-text("Opmerking")');
await p.waitForSelector('.overlay textarea');
const taak = (await p.textContent('.overlay .stil')).trim();
await p.fill('.overlay textarea', 'De kraan lekt een beetje');
await p.click('.overlay button:has-text("Opslaan")');
await p.waitForTimeout(700);
await p.click('#bericht-knop');
await p.waitForSelector('.gesprek');
const eind = await p.locator('.gesprek .bericht').last().textContent();
r.ok('de opmerking staat in het gesprek', /kraan lekt/.test(eind), eind.replace(/\s+/g, ' ').trim().slice(0, 80));
r.ok('met de taak erbij', eind.includes(taak), taak);
await p.click('.overlay button:has-text("Sluiten")');
await p.screenshot({ path: process.env.SP ? `${process.env.SP}/berichten.png` : 'berichten.png' });

/* --- een bericht van thuis geeft een telletje --- */
r.ok('nu geen telletje', await p.locator('#bericht-knop .teller').count() === 0);

const b = r.volg(await ctx.newPage());
await b.setViewportSize({ width: 1100, height: 950 });
await b.goto(BEHEER);
await b.waitForSelector('.taaklijst li');
await b.click('.tab[data-tab=berichten]');
await b.waitForSelector('#scherm');
await b.click('button:has-text("Bericht sturen")');
await b.waitForSelector('.overlay textarea');
await b.fill('.overlay textarea', 'Nieuwe zakken liggen in de bijkeuken');
await b.click('.overlay button:has-text("Versturen")');
await b.waitForTimeout(800);
await b.close();

await p.reload();
await p.waitForSelector('#lijst li.taak');
r.ok('zij ziet een telletje op de knop', await p.textContent('#bericht-knop .teller') === '1',
  await p.locator('#bericht-knop').textContent());

await p.click('#bericht-knop');
await p.waitForSelector('.gesprek');
r.ok('het nieuwe bericht van thuis staat onderaan',
  /bijkeuken/.test(await p.locator('.gesprek .bericht').last().textContent()));
await p.click('.overlay button:has-text("Sluiten")');
await p.waitForTimeout(600);
r.ok('en het telletje is weg na het lezen', await p.locator('#bericht-knop .teller').count() === 0);
r.ok('zonder losse rommel in de knop', (await p.textContent('#bericht-knop')).trim() === '💬 Berichten',
  (await p.textContent('#bericht-knop')).trim());

await browser.close();
process.exit(r.afsluiten() ? 1 : 0);
