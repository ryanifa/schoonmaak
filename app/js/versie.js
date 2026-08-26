/* Welke versie van de app draait hier?

   Bij het publiceren stempelt de workflow versie.json en de naam van de
   service-worker-cache met het commit-nummer. Daardoor vervalt de oude cache
   vanzelf bij een nieuwe versie, en kan de app zien dat er iets nieuws klaarstaat. */

let gelezen = null;

export async function haalVersie() {
  if (gelezen) return gelezen;
  try {
    const antwoord = await fetch('./versie.json', { cache: 'no-store' });
    gelezen = antwoord.ok ? await antwoord.json() : { versie: 'onbekend' };
  } catch {
    gelezen = { versie: 'onbekend' };
  }
  return gelezen;
}

/** Kort regeltje voor onder aan het scherm. */
export async function versieRegel() {
  const { versie, datum } = await haalVersie();
  if (!datum) return `Versie: ${versie}`;
  const d = new Date(datum);
  const dag = `${d.getDate()}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  return `Versie ${versie} · gepubliceerd ${dag}`;
}
