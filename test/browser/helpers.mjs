/* Gereedschap voor de browsertests. */

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

export const URL_BASIS = process.env.APP_URL || 'http://localhost:4321';

/** Testmodus-links: geen sleutel, geen GitHub. */
export const BEHEER = `${URL_BASIS}/beheer.html#c=eyJ4IjoxLCJyIjoiYmVoZWVyZGVyIn0`;
export const TELEFOON = `${URL_BASIS}/schoonmaak.html#c=eyJ4IjoxLCJyIjoic2Nob29ubWFha2VyIn0`;

export function rapport(naam) {
  const fouten = [];
  const jsFouten = [];
  console.log(`\n— ${naam} —`);
  return {
    jsFouten,
    ok(omschrijving, waar, extra = '') {
      if (!waar) fouten.push(omschrijving);
      console.log(`${waar ? '  ok ' : 'FOUT'}  ${omschrijving}${extra ? ` — ${extra}` : ''}`);
    },
    /** Let de pagina in de gaten voor fouten die anders ongemerkt voorbijgaan. */
    volg(pagina) {
      pagina.on('pageerror', (e) => jsFouten.push(e.message));
      return pagina;
    },
    afsluiten() {
      this.ok('geen JavaScript-fouten', jsFouten.length === 0, jsFouten.slice(0, 2).join(' | '));
      console.log(fouten.length ? `${fouten.length} mislukt: ${fouten.join(', ')}` : 'Alle controles geslaagd');
      return fouten.length;
    },
  };
}

export async function laptop(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 950 } });
  await ctx.route('https://api.github.com/**', (r) => r.abort('failed'));
  return ctx;
}

export async function telefoon(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await ctx.route('https://api.github.com/**', (r) => r.abort('failed'));
  return ctx;
}

/**
 * Zet een verzetbare klok op een pagina. Eén init-script dat de verschuiving uit
 * localStorage leest: `addInitScript` stapelt op, dus twee keer aanroepen zou de
 * klok dubbel verzetten.
 */
export async function metTestklok(pagina) {
  await pagina.addInitScript(() => {
    const Echt = Date;
    const verschuiving = () => Number(localStorage.getItem('testklok') || 0);
    // eslint-disable-next-line no-global-assign
    Date = class extends Echt {
      constructor(...args) {
        if (args.length === 0) super(Echt.now() + verschuiving());
        else super(...args);
      }
      static now() { return Echt.now() + verschuiving(); }
    };
  });
  return {
    /** Zet de klok van de pagina op `uren` na nu en herlaadt. */
    async verzet(uren) {
      await pagina.evaluate((u) => localStorage.setItem('testklok', String(u * 3600000)), uren);
      await pagina.reload();
    },
  };
}

export { chromium };
