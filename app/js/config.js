/* De toegangsgegevens: welke Gists, welke sleutel, welke rol.
   Ze komen binnen via het #-deel van de link. Dat deel wordt door browsers niet
   naar servers gestuurd, en we halen het na het opslaan meteen uit de adresbalk. */

const OPSLAG_SLEUTEL = 'schoonmaak.toegang';

function naarBase64url(tekst) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(tekst)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function uitBase64url(tekst) {
  const gevuld = tekst.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(tekst.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(gevuld), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Bouwt een deelbare link voor één rol. */
export function maakLink(basisUrl, rol, toegang) {
  const map = new URL('.', basisUrl).href; // de map waarin de app staat
  const pagina = rol === 'beheerder' ? 'beheer.html' : 'schoonmaak.html';
  const inhoud = naarBase64url(JSON.stringify(toegang.test
    ? { x: 1, r: rol }
    : {
      s: toegang.sleutel,
      d: toegang.dataGist,
      f: toegang.fotoGist,
      g: toegang.gebruiker || undefined,
      r: rol,
    }));
  return `${map}${pagina}#c=${inhoud}`;
}

function leesUitHash() {
  const hash = location.hash.slice(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const c = params.get('c');
  if (!c) return null;
  try {
    const rauw = JSON.parse(uitBase64url(c));
    const rol = rauw.r === 'beheerder' ? 'beheerder' : 'schoonmaakster';
    if (rauw.x) return { test: true, sleutel: null, dataGist: null, fotoGist: null, gebruiker: null, rol };
    if (!rauw.s || !rauw.d) return null;
    return {
      test: false,
      sleutel: rauw.s,
      dataGist: rauw.d,
      fotoGist: rauw.f || null,
      gebruiker: rauw.g || null,
      rol,
    };
  } catch {
    return null;
  }
}

function leesUitOpslag() {
  try {
    const rauw = localStorage.getItem(OPSLAG_SLEUTEL);
    if (!rauw) return null;
    const bewaard = JSON.parse(rauw);
    if (bewaard?.test) return bewaard;
    return bewaard?.sleutel && bewaard?.dataGist ? bewaard : null;
  } catch {
    return null;
  }
}

export function bewaarToegang(toegang) {
  try {
    localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify(toegang));
  } catch { /* privémodus: dan geldt hij alleen deze sessie */ }
}

export function vergeetToegang() {
  try {
    localStorage.removeItem(OPSLAG_SLEUTEL);
  } catch { /* niets aan te doen */ }
}

/**
 * Haalt de toegang op: eerst uit de link, anders uit wat er eerder bewaard is.
 * @param {'beheerder'|'schoonmaakster'} verwachteRol
 */
export function haalToegang(verwachteRol) {
  const uitLink = leesUitHash();
  if (uitLink) {
    // De rol hoort bij de pagina, niet bij wat er in de link staat.
    const toegang = { ...uitLink, rol: verwachteRol };
    bewaarToegang(toegang);
    // Sleutel uit de adresbalk halen: die blijft anders in de geschiedenis staan.
    history.replaceState(null, '', location.pathname + location.search);
    return toegang;
  }
  const bewaard = leesUitOpslag();
  return bewaard ? { ...bewaard, rol: verwachteRol } : null;
}

/** Toegang voor de testmodus: alles blijft in deze browser. */
export function testToegang(rol) {
  return { test: true, sleutel: null, dataGist: null, fotoGist: null, gebruiker: null, rol };
}

export { naarBase64url, uitBase64url };
