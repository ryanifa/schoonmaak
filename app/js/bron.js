/* Waar de bestanden vandaan komen en heen gaan.
   Twee smaken met dezelfde vorm: de echte Gist, en een lokale variant voor de
   testmodus. Doordat ze hetzelfde doen, loopt de testmodus door precies dezelfde
   synchronisatiecode als het echte werk — inclusief wachtrij en samenvoegen. */

import { haalGist, schrijfGist, GistFout } from './gist.js';

export class GistBron {
  constructor(sleutel, gistId) {
    this.sleutel = sleutel;
    this.gistId = gistId;
  }

  /** @returns {{ongewijzigd: boolean, etag?: string, bestanden?: Record<string,string>}} */
  haal(etag) {
    return haalGist(this.sleutel, this.gistId, etag);
  }

  /** @returns {{etag: string|null}} */
  schrijf(bestanden) {
    return schrijfGist(this.sleutel, this.gistId, bestanden);
  }
}

/**
 * Testmodus: alles blijft in deze browser. Bootst de Gist zo precies mogelijk
 * na, inclusief ETags, zodat je de app echt kunt doorlopen zonder sleutel.
 */
export class LokaleBron {
  constructor(naam) {
    this.naam = `schoonmaak.test.${naam}`;
  }

  lees() {
    try {
      const rauw = localStorage.getItem(this.naam);
      return rauw ? JSON.parse(rauw) : { bestanden: {}, versie: 0 };
    } catch {
      return { bestanden: {}, versie: 0 };
    }
  }

  bewaar(stand) {
    try {
      localStorage.setItem(this.naam, JSON.stringify(stand));
    } catch {
      throw new GistFout('De testopslag in deze browser zit vol.');
    }
  }

  async haal(etag) {
    const stand = this.lees();
    const huidig = `"t${stand.versie}"`;
    if (etag && etag === huidig) return { ongewijzigd: true, etag };
    return { ongewijzigd: false, etag: huidig, bestanden: stand.bestanden, gebruiker: 'testmodus' };
  }

  async schrijf(bestanden) {
    const stand = this.lees();
    for (const [naam, inhoud] of Object.entries(bestanden)) {
      if (inhoud === null) delete stand.bestanden[naam];
      else stand.bestanden[naam] = inhoud;
    }
    stand.versie += 1;
    this.bewaar(stand);
    return { etag: `"t${stand.versie}"` };
  }

  wis() {
    try {
      localStorage.removeItem(this.naam);
    } catch { /* niets aan te doen */ }
  }
}

/** Kiest de juiste bron bij de toegang. */
export function bronVoor(toegang, welke) {
  const gistId = welke === 'fotos' ? toegang.fotoGist : toegang.dataGist;
  if (toegang.test) return new LokaleBron(welke);
  return gistId ? new GistBron(toegang.sleutel, gistId) : null;
}
