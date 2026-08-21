/* Foto's staan in een eigen Gist, één bestand per foto, als base64.
   Ze worden apart bewaard zodat de weeklijst snel laadt: die is een paar kilobyte,
   de foto's zijn dat niet. Eenmaal opgehaalde foto's blijven in IndexedDB staan,
   zodat de telefoon ze offline ook heeft en er daarna niets meer geladen hoeft. */

import { haalGist, schrijfGist } from './gist.js';

const DB_NAAM = 'schoonmaak-fotos';
const WINKEL = 'fotos';

function open() {
  return new Promise((klaar, mislukt) => {
    if (!globalThis.indexedDB) return klaar(null);
    const verzoek = indexedDB.open(DB_NAAM, 1);
    verzoek.onupgradeneeded = () => {
      const db = verzoek.result;
      if (!db.objectStoreNames.contains(WINKEL)) db.createObjectStore(WINKEL);
    };
    verzoek.onsuccess = () => klaar(verzoek.result);
    verzoek.onerror = () => klaar(null);
    setTimeout(() => klaar(null), 3000);
  });
}

async function uitDb(sleutel) {
  const db = await open();
  if (!db) return null;
  return new Promise((klaar) => {
    const v = db.transaction(WINKEL, 'readonly').objectStore(WINKEL).get(sleutel);
    v.onsuccess = () => klaar(v.result ?? null);
    v.onerror = () => klaar(null);
  });
}

async function naarDb(paren) {
  const db = await open();
  if (!db) return;
  await new Promise((klaar) => {
    const tx = db.transaction(WINKEL, 'readwrite');
    const winkel = tx.objectStore(WINKEL);
    for (const [sleutel, waarde] of paren) winkel.put(waarde, sleutel);
    tx.oncomplete = () => klaar();
    tx.onerror = () => klaar();
    tx.onabort = () => klaar();
  });
}

const bestandsnaam = (fotoId) => `foto-${fotoId}.b64`;

export class FotoOpslag extends EventTarget {
  constructor(toegang) {
    super();
    this.toegang = toegang;
    this.fotos = new Map();   // fotoId -> data-URL
    this.etag = null;
    this.geladen = false;
    this.bezig = null;
  }

  url(fotoId) {
    return this.fotos.get(fotoId) || null;
  }

  /**
   * Haalt de foto's op die nog ontbreken.
   *
   * Een foto verandert nooit: een vervangen foto krijgt een nieuw id. Hebben we
   * alles al in IndexedDB staan, dan hoeft er dus niets over de lijn — ook niet
   * om te controleren. Dat scheelt de telefoon megabytes, en het werkt ook als
   * de ETag van GitHub om wat voor reden dan ook niet leesbaar is.
   *
   * @param {Iterable<string>} [nodigeIds] de foto's die de weergave nu nodig heeft
   */
  async laad(nodigeIds = null) {
    if (!this.toegang.fotoGist) { this.geladen = true; return; }
    if (this.bezig) return this.bezig;
    this.bezig = this.laadNu(nodigeIds).finally(() => { this.bezig = null; });
    return this.bezig;
  }

  async laadNu(nodigeIds) {
    const bewaard = await uitDb('index');
    if (bewaard?.fotos) {
      this.fotos = new Map(Object.entries(bewaard.fotos));
      this.etag = bewaard.etag || null;
      this.geladen = true;
      this.dispatchEvent(new Event('verandering'));
    }
    if (nodigeIds) {
      const ontbreekt = [...nodigeIds].filter((id) => id && !this.fotos.has(id));
      if (this.geladen && !ontbreekt.length) return; // alles al op het toestel
    }

    try {
      const antwoord = await haalGist(this.toegang.sleutel, this.toegang.fotoGist, this.etag);
      if (antwoord.ongewijzigd) { this.geladen = true; return; }

      const nieuw = new Map();
      for (const [naam, inhoud] of Object.entries(antwoord.bestanden)) {
        const m = naam.match(/^foto-(.+)\.b64$/);
        if (!m || !inhoud) continue;
        nieuw.set(m[1], `data:image/jpeg;base64,${inhoud.trim()}`);
      }
      this.fotos = nieuw;
      this.etag = antwoord.etag;
      this.geladen = true;
      await naarDb([['index', { fotos: Object.fromEntries(nieuw), etag: this.etag }]]);
      this.dispatchEvent(new Event('verandering'));
    } catch (fout) {
      // Zonder netwerk werken we met wat er in IndexedDB staat.
      if (!this.geladen) this.dispatchEvent(new CustomEvent('fout', { detail: fout }));
    }
  }

  /** Voegt een foto toe. `base64` is de inhoud zonder 'data:'-voorvoegsel. */
  async bewaar(fotoId, base64) {
    await schrijfGist(this.toegang.sleutel, this.toegang.fotoGist, { [bestandsnaam(fotoId)]: base64 });
    this.fotos.set(fotoId, `data:image/jpeg;base64,${base64}`);
    this.etag = null; // volgende keer opnieuw ophalen
    await naarDb([['index', { fotos: Object.fromEntries(this.fotos), etag: null }]]);
    this.dispatchEvent(new Event('verandering'));
  }

  async verwijder(fotoId) {
    await schrijfGist(this.toegang.sleutel, this.toegang.fotoGist, { [bestandsnaam(fotoId)]: null });
    this.fotos.delete(fotoId);
    this.etag = null;
    await naarDb([['index', { fotos: Object.fromEntries(this.fotos), etag: null }]]);
    this.dispatchEvent(new Event('verandering'));
  }
}
