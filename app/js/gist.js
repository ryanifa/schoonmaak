/* Praten met de Gist-API van GitHub. Dit is de enige plek die van GitHub weet. */

const API = 'https://api.github.com';

export class GistFout extends Error {
  constructor(boodschap, { status = 0, netwerk = false, tijdelijk = false } = {}) {
    super(boodschap);
    this.status = status;
    this.netwerk = netwerk;
    this.tijdelijk = tijdelijk || netwerk;
  }
}

/** Vertaalt een HTTP-antwoord naar een begrijpelijke Nederlandse fout. */
function foutVoor(status, lichaam) {
  const bericht = lichaam?.message || '';
  if (status === 401) return new GistFout('De sleutel klopt niet of is verlopen.', { status });
  if (status === 403 && /rate limit/i.test(bericht)) {
    return new GistFout('Te veel verzoeken naar GitHub. Probeer het over een minuutje opnieuw.', { status, tijdelijk: true });
  }
  if (status === 403) return new GistFout('De sleutel heeft geen rechten voor Gists.', { status });
  if (status === 404) return new GistFout('De Gist bestaat niet (meer) of hoort niet bij deze sleutel.', { status });
  if (status === 422) return new GistFout(`GitHub weigerde de gegevens: ${bericht}`, { status });
  if (status >= 500) return new GistFout('GitHub is even niet bereikbaar.', { status, tijdelijk: true });
  return new GistFout(bericht || `Onverwacht antwoord van GitHub (${status}).`, { status });
}

async function verzoek(token, pad, { methode = 'GET', lichaam, etag, timeout = 20000 } = {}) {
  const afbreker = new AbortController();
  const klok = setTimeout(() => afbreker.abort(), timeout);
  const koppen = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    authorization: `Bearer ${token}`,
  };
  if (etag) koppen['if-none-match'] = etag;
  if (lichaam) koppen['content-type'] = 'application/json';

  let antwoord;
  try {
    antwoord = await fetch(API + pad, {
      method: methode,
      headers: koppen,
      body: lichaam ? JSON.stringify(lichaam) : undefined,
      signal: afbreker.signal,
      cache: 'no-store',
    });
  } catch (fout) {
    throw new GistFout('Geen verbinding met GitHub.', { netwerk: true });
  } finally {
    clearTimeout(klok);
  }

  // 304: niets veranderd. Kost geen quotum en is dus de goedkope manier om te pollen.
  if (antwoord.status === 304) return { ongewijzigd: true, etag };

  const tekst = await antwoord.text();
  let data = null;
  if (tekst) { try { data = JSON.parse(tekst); } catch { /* geen JSON */ } }
  if (!antwoord.ok) throw foutVoor(antwoord.status, data);

  return { data, etag: antwoord.headers.get('etag'), ongewijzigd: false };
}

/** Controleert of de sleutel werkt én Gists mag beheren. */
export async function controleerSleutel(token) {
  const { data } = await verzoek(token, '/gists?per_page=1');
  if (!Array.isArray(data)) throw new GistFout('Onverwacht antwoord van GitHub.');
  return true;
}

/** `bestanden` is {naam: inhoud}; de API wil {naam: {content}}. */
export async function maakGist(token, { beschrijving, bestanden, openbaar = false }) {
  const { data } = await verzoek(token, '/gists', {
    methode: 'POST',
    lichaam: { description: beschrijving, public: openbaar, files: alsApiBestanden(bestanden) },
  });
  return { id: data.id, gebruiker: data.owner?.login || null };
}

function alsApiBestanden(bestanden) {
  const uit = {};
  for (const [naam, inhoud] of Object.entries(bestanden)) {
    uit[naam] = inhoud === null ? null : { content: inhoud };
  }
  return uit;
}

/**
 * Haalt een gist op. Met `etag` levert een ongewijzigde gist een goedkope 304 op.
 * @returns {{ongewijzigd: boolean, etag?: string, bestanden?: Record<string,string>}}
 */
export async function haalGist(token, gistId, etag) {
  const antwoord = await verzoek(token, `/gists/${gistId}`, { etag });
  if (antwoord.ongewijzigd) return { ongewijzigd: true, etag };

  const bestanden = {};
  const afgekapt = [];
  for (const [naam, bestand] of Object.entries(antwoord.data.files || {})) {
    if (bestand.truncated) afgekapt.push({ naam, rauwUrl: bestand.raw_url });
    else bestanden[naam] = bestand.content ?? '';
  }
  // Bestanden boven 1 MB komen niet mee in het antwoord; die halen we apart op.
  for (const { naam, rauwUrl } of afgekapt) {
    try {
      const rauw = await fetch(rauwUrl, { cache: 'no-store' });
      bestanden[naam] = rauw.ok ? await rauw.text() : '';
    } catch {
      bestanden[naam] = '';
    }
  }
  return { ongewijzigd: false, etag: antwoord.etag, bestanden, gebruiker: antwoord.data.owner?.login || null };
}

/**
 * Schrijft bestanden weg. Een waarde van `null` verwijdert het bestand.
 * GitHub laat ongenoemde bestanden met rust.
 */
export async function schrijfGist(token, gistId, bestanden) {
  const { data, etag } = await verzoek(token, `/gists/${gistId}`, {
    methode: 'PATCH', lichaam: { files: alsApiBestanden(bestanden) },
  });
  return { etag, bijgewerktOp: data.updated_at };
}
