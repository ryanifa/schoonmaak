/* Kleine hulpjes: DOM-opbouw en Nederlandse datums. */

export function el(tag, eigenschappen = {}, kinderen = []) {
  const knoop = document.createElement(tag);
  for (const [sleutel, waarde] of Object.entries(eigenschappen)) {
    if (waarde === null || waarde === undefined || waarde === false) continue;
    if (sleutel === 'class') knoop.className = waarde;
    else if (sleutel === 'tekst') knoop.textContent = waarde;
    else if (sleutel === 'html') knoop.innerHTML = waarde;
    else if (sleutel === 'stijl') Object.assign(knoop.style, waarde);
    else if (sleutel.startsWith('on')) knoop.addEventListener(sleutel.slice(2), waarde);
    else if (sleutel === 'dataset') Object.assign(knoop.dataset, waarde);
    else if (waarde === true) knoop.setAttribute(sleutel, '');
    else knoop.setAttribute(sleutel, waarde);
  }
  for (const kind of [].concat(kinderen)) {
    if (kind === null || kind === undefined || kind === false) continue;
    knoop.append(kind.nodeType ? kind : document.createTextNode(String(kind)));
  }
  return knoop;
}

export function leeg(knoop) {
  while (knoop.firstChild) knoop.removeChild(knoop.firstChild);
  return knoop;
}

/** Als append(), maar negeert null/false — anders komt de tekst "null" in beeld. */
export function voegToe(knoop, ...kinderen) {
  for (const kind of kinderen.flat()) {
    if (kind === null || kind === undefined || kind === false) continue;
    knoop.append(kind);
  }
  return knoop;
}

export const $ = (selector, wortel = document) => wortel.querySelector(selector);
export const $$ = (selector, wortel = document) => [...wortel.querySelectorAll(selector)];

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
  'augustus', 'september', 'oktober', 'november', 'december'];

export function uitDatumTekst(tekst) {
  const [j, m, d] = String(tekst).split('-').map(Number);
  return new Date(j, m - 1, d);
}

/** "maandag 24 augustus" */
export function langeDatum(datumOfTekst, metJaar = false) {
  const d = typeof datumOfTekst === 'string' ? uitDatumTekst(datumOfTekst) : datumOfTekst;
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]}${metJaar ? ` ${d.getFullYear()}` : ''}`;
}

/** "24 aug" */
export function korteDatum(datumOfTekst) {
  const d = typeof datumOfTekst === 'string' ? uitDatumTekst(datumOfTekst) : datumOfTekst;
  return `${d.getDate()} ${MAANDEN[d.getMonth()].slice(0, 3)}`;
}

/** "vandaag om 10:15" / "gisteren om 9:02" / "di 19 aug om 14:30" */
export function tijdstempel(isoTekst) {
  if (!isoTekst) return '';
  const d = new Date(isoTekst);
  if (Number.isNaN(d.getTime())) return '';
  const tijd = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const vandaag = new Date();
  const dagVerschil = Math.round(
    (new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate())
      - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000,
  );
  if (dagVerschil === 0) return `vandaag om ${tijd}`;
  if (dagVerschil === 1) return `gisteren om ${tijd}`;
  return `${korteDatum(d)} om ${tijd}`;
}

/** "Week 35 — vanaf maandag 24 augustus" */
export function weekTitel(week) {
  return `Week ${week.weeknummer} — vanaf ${langeDatum(week.startdatum)}`;
}

/** "5 weken geleden" / "deze week" / "nog niet gedaan" */
export function wekenGeledenTekst(weken) {
  if (weken === null || weken === undefined) return 'nog nooit gedaan';
  if (weken <= 0) return 'deze week gedaan';
  if (weken === 1) return 'vorige week';
  return `${weken} weken geleden`;
}

export function meervoud(aantal, enkel, meer) {
  return `${aantal} ${aantal === 1 ? enkel : meer}`;
}

/** Verkleint en comprimeert een foto in de browser vóór het uploaden. */
export async function verkleinAfbeelding(bestand, maxZijde = 1400, kwaliteit = 0.82) {
  const bitmap = await maakBitmap(bestand);
  const schaal = Math.min(1, maxZijde / Math.max(bitmap.width, bitmap.height));
  const breedte = Math.max(1, Math.round(bitmap.width * schaal));
  const hoogte = Math.max(1, Math.round(bitmap.height * schaal));
  const canvas = document.createElement('canvas');
  canvas.width = breedte;
  canvas.height = hoogte;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, breedte, hoogte);
  if (bitmap.close) bitmap.close();
  const blob = await new Promise((klaar) => canvas.toBlob(klaar, 'image/jpeg', kwaliteit));
  if (!blob) throw new Error('Foto kon niet verwerkt worden.');
  return blob;
}

function maakBitmap(bestand) {
  // createImageBitmap kent oriëntatie-correctie, maar ontbreekt op oudere Androids.
  if (window.createImageBitmap) {
    return createImageBitmap(bestand, { imageOrientation: 'from-image' }).catch(() => viaImgElement(bestand));
  }
  return viaImgElement(bestand);
}

function viaImgElement(bestand) {
  return new Promise((klaar, mislukt) => {
    const url = URL.createObjectURL(bestand);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); klaar(img); };
    img.onerror = () => { URL.revokeObjectURL(url); mislukt(new Error('Kan de foto niet lezen.')); };
    img.src = url;
  });
}

export function vinkIcoon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const pad = document.createElementNS(ns, 'polyline');
  pad.setAttribute('points', '4,12.5 9.5,18 20,6.5');
  svg.append(pad);
  return svg;
}
