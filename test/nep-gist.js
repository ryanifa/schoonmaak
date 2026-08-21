/* Een nagebouwde Gist-API, zodat het synchroniseren getest kan worden zonder
   echte GitHub-verzoeken. Bootst de stukken na die de app gebruikt:
   ETags, 304 bij ongewijzigd, PATCH dat alleen genoemde bestanden aanraakt. */

export class NepGitHub {
  constructor() {
    this.gists = new Map();
    this.tellers = { get: 0, get304: 0, patch: 0, post: 0 };
    this.offline = false;
    this.foutVolgende = null;
    this.geldigeSleutels = new Set(['goede-sleutel']);
    this.vertraging = 0;
    this.bijElkeGet = null;
    // ETag is niet standaard leesbaar bij cross-origin verzoeken; met deze
    // schakelaar testen we of de app het ook zonder redt.
    this.verbergEtag = false;
  }

  maakGist(id, bestanden) {
    this.gists.set(id, { id, bestanden: { ...bestanden }, versie: 1, eigenaar: 'testgebruiker' });
    return id;
  }

  etagVan(gist) {
    return `"v${gist.versie}"`;
  }

  /** Vervangt globalThis.fetch. Geeft een functie terug die dat weer terugdraait. */
  installeer() {
    const echte = globalThis.fetch;
    globalThis.fetch = (url, opties = {}) => this.afhandelen(String(url), opties);
    return () => { globalThis.fetch = echte; };
  }

  async afhandelen(url, opties) {
    if (this.vertraging) await new Promise((k) => setTimeout(k, this.vertraging));
    if (this.offline) throw new TypeError('Failed to fetch');
    if (this.foutVolgende) {
      const status = this.foutVolgende;
      this.foutVolgende = null;
      return this.antwoord(status, { message: 'nagebootste fout' });
    }

    const sleutel = (opties.headers?.authorization || '').replace('Bearer ', '');
    if (!this.geldigeSleutels.has(sleutel)) return this.antwoord(401, { message: 'Bad credentials' });

    const methode = opties.method || 'GET';
    const pad = url.replace('https://api.github.com', '');

    if (pad.startsWith('/gists?')) return this.antwoord(200, []);

    if (pad === '/gists' && methode === 'POST') {
      this.tellers.post += 1;
      const lichaam = JSON.parse(opties.body);
      const id = `gist${this.gists.size + 1}`;
      const bestanden = {};
      for (const [naam, b] of Object.entries(lichaam.files)) bestanden[naam] = b.content;
      this.maakGist(id, bestanden);
      return this.antwoord(201, { id, owner: { login: 'testgebruiker' }, files: {} });
    }

    const m = pad.match(/^\/gists\/([^/?]+)$/);
    if (!m) return this.antwoord(404, { message: 'Not Found' });
    const gist = this.gists.get(m[1]);
    if (!gist) return this.antwoord(404, { message: 'Not Found' });

    if (methode === 'GET') {
      this.tellers.get += 1;
      if (this.bijElkeGet) await this.bijElkeGet(gist);
      const etag = this.etagVan(gist);
      if (opties.headers?.['if-none-match'] === etag) {
        this.tellers.get304 += 1;
        return this.antwoord(304, null, { etag });
      }
      return this.antwoord(200, this.alsApi(gist), { etag });
    }

    if (methode === 'PATCH') {
      this.tellers.patch += 1;
      const lichaam = JSON.parse(opties.body);
      for (const [naam, b] of Object.entries(lichaam.files || {})) {
        if (b === null) delete gist.bestanden[naam];
        else gist.bestanden[naam] = b.content;
      }
      gist.versie += 1;
      return this.antwoord(200, this.alsApi(gist), { etag: this.etagVan(gist) });
    }

    return this.antwoord(405, { message: 'Method Not Allowed' });
  }

  alsApi(gist) {
    const files = {};
    for (const [naam, inhoud] of Object.entries(gist.bestanden)) {
      files[naam] = {
        filename: naam,
        size: inhoud.length,
        truncated: false,
        content: inhoud,
        raw_url: `https://gist.githubusercontent.com/testgebruiker/${gist.id}/raw/${naam}`,
      };
    }
    return { id: gist.id, owner: { login: gist.eigenaar }, files, updated_at: new Date().toISOString() };
  }

  antwoord(status, data, koppen = {}) {
    const tekst = data === null ? '' : JSON.stringify(data);
    if (this.verbergEtag) delete koppen.etag;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (naam) => koppen[naam.toLowerCase()] ?? null },
      text: async () => tekst,
      json: async () => data,
    };
  }
}

/** Minimale localStorage voor tests in Node. */
export function nepLocalStorage() {
  const kaart = new Map();
  return {
    getItem: (k) => (kaart.has(k) ? kaart.get(k) : null),
    setItem: (k, v) => kaart.set(k, String(v)),
    removeItem: (k) => kaart.delete(k),
    clear: () => kaart.clear(),
    get lengte() { return kaart.size; },
  };
}
