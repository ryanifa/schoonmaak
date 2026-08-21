/* De opslag: houdt het document bij, verzamelt bewerkingen en schrijft ze naar
   de Gist. Bewerkingen worden vóór het wegschrijven opnieuw afgespeeld op de
   verse Gist-inhoud, zodat wijzigingen van de telefoon en de laptop niet van
   elkaar verloren gaan. */

import { haalGist, schrijfGist, GistFout } from './gist.js';
import { leegDocument, speelAf, geraakteDelen, DOCUMENT_VERSIE } from './document.js';

const BESTANDEN = {
  bibliotheek: 'schoonmaak-bibliotheek.json',
  weken: 'schoonmaak-weken.json',
  berichten: 'schoonmaak-berichten.json',
};

export function documentNaarBestanden(doc, delen = Object.keys(BESTANDEN)) {
  const uit = {};
  if (delen.includes('bibliotheek')) {
    uit[BESTANDEN.bibliotheek] = JSON.stringify(
      { versie: doc.versie ?? DOCUMENT_VERSIE, ruimtes: doc.ruimtes, taken: doc.taken }, null, 1,
    );
  }
  if (delen.includes('weken')) {
    uit[BESTANDEN.weken] = JSON.stringify({ weken: doc.weken }, null, 1);
  }
  if (delen.includes('berichten')) {
    uit[BESTANDEN.berichten] = JSON.stringify({ berichten: doc.berichten }, null, 1);
  }
  return uit;
}

export function bestandenNaarDocument(bestanden) {
  const doc = leegDocument();
  const lees = (naam) => {
    const rauw = bestanden[naam];
    if (!rauw) return null;
    try {
      return JSON.parse(rauw);
    } catch {
      throw new GistFout(`Het bestand ${naam} in de Gist is beschadigd en kon niet gelezen worden.`);
    }
  };
  const bib = lees(BESTANDEN.bibliotheek);
  if (bib) {
    doc.versie = bib.versie ?? DOCUMENT_VERSIE;
    doc.ruimtes = bib.ruimtes || [];
    doc.taken = bib.taken || [];
  }
  const weken = lees(BESTANDEN.weken);
  if (weken) doc.weken = weken.weken || {};
  const berichten = lees(BESTANDEN.berichten);
  if (berichten) doc.berichten = berichten.berichten || [];
  return doc;
}

export class Opslag extends EventTarget {
  /**
   * @param {{sleutel: string, dataGist: string, rol: string}} toegang
   */
  constructor(toegang, { nu = () => new Date().toISOString() } = {}) {
    super();
    this.toegang = toegang;
    this.nu = nu;
    this.serverDoc = leegDocument();
    this.etag = null;
    this.wachtrij = this.laadWachtrij();
    this.bezig = false;
    this.wachtTimer = null;
    this.pogingen = 0;
    this.geladen = false;
    this.laatsteFout = null;
  }

  get wachtrijSleutel() {
    return `schoonmaak.wachtrij.${this.toegang.dataGist}.${this.toegang.rol}`;
  }

  /** Het document zoals het er nú uitziet: server plus wat nog verstuurd moet worden. */
  document() {
    return this.wachtrij.length ? speelAf(this.serverDoc, this.wachtrij) : this.serverDoc;
  }

  laadWachtrij() {
    try {
      const rauw = localStorage.getItem(this.wachtrijSleutel);
      const items = rauw ? JSON.parse(rauw) : [];
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  bewaarWachtrij() {
    try {
      localStorage.setItem(this.wachtrijSleutel, JSON.stringify(this.wachtrij));
    } catch { /* vol of privémodus: dan alleen in het geheugen */ }
  }

  /** Bewaart het laatst bekende document, zodat de app offline meteen iets kan tonen. */
  bewaarMomentopname() {
    try {
      localStorage.setItem(`schoonmaak.doc.${this.toegang.dataGist}`,
        JSON.stringify({ doc: this.serverDoc, etag: this.etag }));
    } catch { /* te groot: dan alleen online */ }
  }

  laadMomentopname() {
    try {
      const rauw = localStorage.getItem(`schoonmaak.doc.${this.toegang.dataGist}`);
      if (!rauw) return false;
      const { doc, etag } = JSON.parse(rauw);
      if (!doc) return false;
      this.serverDoc = doc;
      this.etag = etag || null;
      this.geladen = true;
      return true;
    } catch {
      return false;
    }
  }

  meld(soort, extra = {}) {
    this.dispatchEvent(new CustomEvent(soort, { detail: { opslag: this, ...extra } }));
  }

  meldStatus() {
    this.meld('status', {
      openstaand: this.wachtrij.length,
      bezig: this.bezig,
      fout: this.laatsteFout,
    });
  }

  /** Eerste keer laden. Gebruikt de bewaarde momentopname zolang het netwerk traag is. */
  async begin() {
    const uitCache = this.laadMomentopname();
    if (uitCache) this.meld('verandering');
    try {
      await this.ververs({ geforceerd: !uitCache });
    } catch (fout) {
      if (!uitCache) throw fout;
      this.laatsteFout = fout;
      this.meldStatus();
    }
    if (this.wachtrij.length) this.verstuur();
    return this.document();
  }

  /** Haalt de nieuwste stand op. Ongewijzigd? Dan kost dat geen quotum. */
  async ververs({ geforceerd = false } = {}) {
    const antwoord = await haalGist(this.toegang.sleutel, this.toegang.dataGist, geforceerd ? null : this.etag);
    if (antwoord.ongewijzigd) return false;
    this.serverDoc = bestandenNaarDocument(antwoord.bestanden);
    this.etag = antwoord.etag;
    this.geladen = true;
    this.laatsteFout = null;
    this.bewaarMomentopname();
    this.meld('verandering');
    this.meldStatus();
    return true;
  }

  /**
   * Voert een bewerking uit: meteen zichtbaar, daarna pas verstuurd.
   * `vervangSleutel` laat een nieuwe bewerking een eerdere overschrijven, zodat
   * drie keer aan-en-uit tikken één verzoek oplevert.
   */
  doe(bewerking, { vervangSleutel = null } = {}) {
    const item = { ...bewerking, tijd: bewerking.tijd || this.nu(), sleutel: vervangSleutel };
    if (vervangSleutel) {
      const index = this.wachtrij.findIndex((b) => b.sleutel === vervangSleutel);
      if (index >= 0) this.wachtrij[index] = item;
      else this.wachtrij.push(item);
    } else {
      this.wachtrij.push(item);
    }
    this.bewaarWachtrij();
    this.meld('verandering');
    this.meldStatus();
    this.plan();
  }

  /** Even wachten voordat we versturen, zodat snel achter elkaar tikken één schrijfactie wordt. */
  plan(vertraging = 700) {
    clearTimeout(this.wachtTimer);
    this.wachtTimer = setTimeout(() => this.verstuur(), vertraging);
  }

  /** Loopt er al een verzending, dan wachten we daarop in plaats van niets te doen. */
  verstuur(opties = {}) {
    if (this.bezigBelofte) return this.bezigBelofte;
    if (!this.wachtrij.length) return Promise.resolve();
    this.bezigBelofte = this.verstuurNu(opties).finally(() => { this.bezigBelofte = null; });
    return this.bezigBelofte;
  }

  async verstuurNu({ handmatig = false } = {}) {
    clearTimeout(this.wachtTimer);
    this.bezig = true;
    if (handmatig) this.pogingen = 0;
    this.meldStatus();

    const teVersturen = [...this.wachtrij];
    try {
      const nieuw = await this.schrijfMetSamenvoegen(teVersturen);

      this.serverDoc = nieuw;
      this.geladen = true;
      // Alleen weghalen wat we echt verstuurd hebben; ondertussen kan er meer bij zijn gekomen.
      this.wachtrij = this.wachtrij.slice(teVersturen.length);
      this.pogingen = 0;
      this.laatsteFout = null;
      this.bewaarWachtrij();
      this.bewaarMomentopname();
      this.meld('opgeslagen');
      this.meld('verandering');
    } catch (fout) {
      this.laatsteFout = fout;
      if (fout.tijdelijk) {
        this.pogingen += 1;
        const wachten = Math.min(2000 * 2 ** Math.min(this.pogingen, 4), 30000);
        this.wachtTimer = setTimeout(() => this.verstuur(), wachten);
      } else {
        // Een blijvende fout (verkeerde sleutel, gist weg) lossen we niet op door te herhalen.
        this.meld('geblokkeerd', { fout });
      }
    } finally {
      this.bezig = false;
      this.meldStatus();
    }
  }

  /**
   * Schrijft de bewerkingen weg en controleert daarna of ze er ook echt in staan.
   * De Gist-API kent geen "schrijf alleen als er niets veranderd is", dus twee
   * apparaten die precies tegelijk schrijven kunnen elkaar overschrijven. Na het
   * schrijven kijken we daarom met de ETag of er nog iemand tussendoor kwam; zo
   * ja, dan spelen we onze bewerkingen op die nieuwe stand opnieuw af.
   * Dat mag, omdat elke bewerking bij herhaling hetzelfde resultaat geeft.
   */
  async schrijfMetSamenvoegen(bewerkingen, maxPogingen = 3) {
    const delen = [...new Set(bewerkingen.flatMap(geraakteDelen))];
    let laatste = null;

    for (let poging = 0; poging < maxPogingen; poging++) {
      const vers = await haalGist(this.toegang.sleutel, this.toegang.dataGist, null);
      const basis = bestandenNaarDocument(vers.bestanden);
      const nieuw = speelAf(basis, bewerkingen);
      laatste = nieuw;

      const ervoor = documentNaarBestanden(basis, delen);
      const erna = documentNaarBestanden(nieuw, delen);
      if (delen.every((deel) => ervoor[BESTANDEN[deel]] === erna[BESTANDEN[deel]])) {
        // Onze bewerkingen staan er al in — iemand anders had ze al meegenomen.
        this.etag = vers.etag;
        return nieuw;
      }

      const { etag } = await schrijfGist(this.toegang.sleutel, this.toegang.dataGist, erna);
      this.etag = etag || null;

      // Ongewijzigd sinds ons eigen schrijven? Dan is niemand ertussen gekomen.
      const controle = await haalGist(this.toegang.sleutel, this.toegang.dataGist, this.etag);
      if (controle.ongewijzigd) return nieuw;
    }
    return laatste;
  }
}
