// Hulpjes rond ISO-weken. Alles rekent met lokale datums op middernacht.

const DAG_MS = 24 * 60 * 60 * 1000;

/** Maandag van de week waarin `datum` valt. */
export function maandagVan(datum) {
  const d = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate());
  const dag = (d.getDay() + 6) % 7; // maandag = 0
  d.setDate(d.getDate() - dag);
  return d;
}

/** ISO-weeknummer en het bijbehorende ISO-jaar. */
export function isoWeek(datum) {
  const d = maandagVan(datum);
  const donderdag = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3);
  const jaar = donderdag.getFullYear();
  const eersteDonderdag = new Date(jaar, 0, 4);
  const eersteMaandag = maandagVan(eersteDonderdag);
  const weeknummer = Math.round((d - eersteMaandag) / (7 * DAG_MS)) + 1;
  return { jaar, weeknummer };
}

/** Maandag van een gegeven ISO-week. */
export function startdatumVanWeek(jaar, weeknummer) {
  const eersteMaandag = maandagVan(new Date(jaar, 0, 4));
  return new Date(
    eersteMaandag.getFullYear(),
    eersteMaandag.getMonth(),
    eersteMaandag.getDate() + (weeknummer - 1) * 7,
  );
}

/** Aantal ISO-weken in een jaar (52 of 53). */
export function wekenInJaar(jaar) {
  return isoWeek(new Date(jaar, 11, 28)).weeknummer;
}

/** De week vóór de gegeven week. */
export function vorigeWeek(jaar, weeknummer) {
  if (weeknummer > 1) return { jaar, weeknummer: weeknummer - 1 };
  return { jaar: jaar - 1, weeknummer: wekenInJaar(jaar - 1) };
}

/** De week ná de gegeven week. */
export function volgendeWeek(jaar, weeknummer) {
  if (weeknummer < wekenInJaar(jaar)) return { jaar, weeknummer: weeknummer + 1 };
  return { jaar: jaar + 1, weeknummer: 1 };
}

/** 'YYYY-MM-DD' zonder tijdzone-verschuiving. */
export function alsDatumTekst(datum) {
  const mm = String(datum.getMonth() + 1).padStart(2, '0');
  const dd = String(datum.getDate()).padStart(2, '0');
  return `${datum.getFullYear()}-${mm}-${dd}`;
}

export function uitDatumTekst(tekst) {
  const [j, m, d] = tekst.split('-').map(Number);
  return new Date(j, m - 1, d);
}

/** Hele weken tussen twee maandagen. */
export function wekenTussen(vanTekst, totTekst) {
  const van = maandagVan(uitDatumTekst(vanTekst));
  const tot = maandagVan(uitDatumTekst(totTekst));
  return Math.round((tot - van) / (7 * DAG_MS));
}

export function huidigeWeek(nu = new Date()) {
  const { jaar, weeknummer } = isoWeek(nu);
  return { jaar, weeknummer, startdatum: alsDatumTekst(startdatumVanWeek(jaar, weeknummer)) };
}
