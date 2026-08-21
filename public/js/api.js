/* Praten met de server. Bestand tegen slecht netwerk: schrijfacties gaan door
   een wachtrij die blijft proberen en die een herstart van de pagina overleeft. */
import { meld, verbergMelding } from './melding.js';

const padDelen = location.pathname.split('/').filter(Boolean);
export const token = padDelen.length >= 2 ? decodeURIComponent(padDelen[1]) : '';
const PIN_SLEUTEL = 'schoonmaak.pincode';
const WACHTRIJ_SLEUTEL = `schoonmaak.wachtrij.${padDelen[0] || 'app'}`;

let pincode = localStorage.getItem(PIN_SLEUTEL) || '';

function koppen(extra = {}) {
  const h = { 'x-schoonmaak-token': token, ...extra };
  if (pincode) h['x-pincode'] = pincode;
  return h;
}

export class ApiFout extends Error {
  constructor(boodschap, status, netwerk = false) {
    super(boodschap);
    this.status = status;
    this.netwerk = netwerk;
  }
}

async function verstuur(methode, pad, body, { timeout = 12000, rauw = null, contentType = null } = {}) {
  const afbreker = new AbortController();
  const klok = setTimeout(() => afbreker.abort(), timeout);
  let antwoord;
  try {
    antwoord = await fetch(pad, {
      method: methode,
      headers: koppen(rauw ? { 'content-type': contentType } : (body !== undefined ? { 'content-type': 'application/json' } : {})),
      body: rauw || (body !== undefined ? JSON.stringify(body) : undefined),
      signal: afbreker.signal,
      cache: 'no-store',
    });
  } catch (fout) {
    throw new ApiFout('Geen verbinding.', 0, true);
  } finally {
    clearTimeout(klok);
  }

  const tekst = await antwoord.text();
  let data = {};
  if (tekst) {
    try { data = JSON.parse(tekst); } catch { data = {}; }
  }
  if (!antwoord.ok) {
    // 5xx en 429 zijn tijdelijk: die mogen opnieuw geprobeerd worden.
    const tijdelijk = antwoord.status >= 500 || antwoord.status === 429;
    const fout = new ApiFout(data.fout || `Er ging iets mis (${antwoord.status}).`, antwoord.status, tijdelijk);
    fout.pinNodig = !!data.pinNodig;
    throw fout;
  }
  return data;
}

export const api = {
  get rol() { return this._rol; },

  haal(pad, query = {}) {
    const zoek = new URLSearchParams(query).toString();
    return verstuur('GET', `${pad}${zoek ? `?${zoek}` : ''}`);
  },

  stuur(methode, pad, body) {
    return verstuur(methode, pad, body ?? {});
  },

  async start() {
    const data = await verstuur('GET', '/api/start');
    this._rol = data.rol;
    return data;
  },

  async uploadFoto(blob) {
    const data = await verstuur('POST', '/api/fotos', undefined, {
      rauw: blob, contentType: blob.type || 'image/jpeg', timeout: 45000,
    });
    return data.foto;
  },

  fotoUrl(fotoId) {
    return `/fotos/${fotoId}?t=${encodeURIComponent(token)}`;
  },

  zetPincode(nieuwe) {
    pincode = nieuwe;
    localStorage.setItem(PIN_SLEUTEL, nieuwe);
  },

  wisPincode() {
    pincode = '';
    localStorage.removeItem(PIN_SLEUTEL);
  },
};

/* ------------------------------------------------------------------ wachtrij */

/**
 * Schrijfacties die niet stilletjes mogen mislukken. Per `sleutel` telt alleen
 * de laatste stand, zodat drie keer aan/uit tikken één verzoek oplevert.
 */
export const wachtrij = {
  items: laadWachtrij(),
  bezig: false,
  luisteraars: new Set(),
  wachtTimer: null,

  opVeranderen(fn) {
    this.luisteraars.add(fn);
    return () => this.luisteraars.delete(fn);
  },

  meldVerandering() {
    for (const fn of this.luisteraars) fn(this.items.length);
  },

  /** @returns {Promise<void>} klaar wanneer dit item verstuurd is (of definitief mislukt). */
  voegToe({ sleutel, methode, pad, body }) {
    const bestaandIndex = this.items.findIndex((i) => i.sleutel === sleutel);
    const item = { sleutel, methode, pad, body, pogingen: 0 };
    if (bestaandIndex >= 0) this.items[bestaandIndex] = item;
    else this.items.push(item);
    bewaarWachtrij(this.items);
    this.meldVerandering();
    this.verwerk();
  },

  async verwerk({ handmatig = false } = {}) {
    if (this.bezig) return;
    if (!this.items.length) { verbergMelding(); return; }
    clearTimeout(this.wachtTimer);
    this.bezig = true;
    if (handmatig) meld('Opnieuw proberen…', 'bezig');

    try {
      while (this.items.length) {
        const item = this.items[0];
        try {
          await verstuur(item.methode, item.pad, item.body);
          this.items.shift();
          bewaarWachtrij(this.items);
          this.meldVerandering();
        } catch (fout) {
          if (fout.netwerk) {
            item.pogingen += 1;
            bewaarWachtrij(this.items);
            this.toonNietOpgeslagen();
            const wachten = Math.min(1000 * 2 ** Math.min(item.pogingen, 5), 30000);
            this.wachtTimer = setTimeout(() => this.verwerk(), wachten);
            return;
          }
          // Blijvende fout (bijv. taak bestaat niet meer): niet eeuwig blijven proberen.
          this.items.shift();
          bewaarWachtrij(this.items);
          this.meldVerandering();
          meld(fout.message, 'fout', { duur: 5000 });
          document.dispatchEvent(new CustomEvent('wachtrij-mislukt', { detail: { item, fout } }));
        }
      }
      meld('Opgeslagen', 'goed');
      document.dispatchEvent(new CustomEvent('wachtrij-leeg'));
    } finally {
      this.bezig = false;
    }
  },

  toonNietOpgeslagen() {
    const n = this.items.length;
    meld(
      n === 1 ? 'Nog niet opgeslagen' : `${n} wijzigingen nog niet opgeslagen`,
      'fout',
      { actie: { tekst: 'Opnieuw', bij: () => this.verwerk({ handmatig: true }) } },
    );
  },
};

function laadWachtrij() {
  try {
    const rauw = localStorage.getItem(WACHTRIJ_SLEUTEL);
    const items = rauw ? JSON.parse(rauw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function bewaarWachtrij(items) {
  try {
    localStorage.setItem(WACHTRIJ_SLEUTEL, JSON.stringify(items));
  } catch { /* vol of privémodus: dan alleen in het geheugen */ }
}

window.addEventListener('online', () => wachtrij.verwerk());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') wachtrij.verwerk();
});
window.addEventListener('beforeunload', (e) => {
  if (wachtrij.items.length) {
    e.preventDefault();
    e.returnValue = '';
  }
});
