/* Gevulde voorbeeldgegevens voor de testmodus: een bibliotheek, een paar weken
   historie en een week die half af is. Zo valt er meteen iets te zien en te doen. */

import { maakVoorbeeldDocument, SEED_VERSIE } from './seed.js';
import { speelAf, weekSleutel, nieuwId } from './document.js';
import { huidigeWeek, vorigeWeek, startdatumVanWeek, alsDatumTekst } from './week.js';
import { LokaleBron } from './bron.js';

/** Tijdstip op een dag in een week, als ISO-tekst. */
function tijdIn(jaar, weeknummer, dagOffset, uur, minuut) {
  const d = startdatumVanWeek(jaar, weeknummer);
  d.setDate(d.getDate() + dagOffset);
  d.setHours(uur, minuut, 0, 0);
  return d.toISOString();
}

export function maakTestDocument() {
  const doc = maakVoorbeeldDocument();
  const nu = huidigeWeek();
  const bewerkingen = [
    { soort: 'schoonmaker.maak', id: 'sm-anna', naam: 'Anna' },
    { soort: 'schoonmaker.maak', id: 'sm-fatima', naam: 'Fatima' },
  ];

  const wekelijks = doc.taken.filter((t) => t.type === 'wekelijks').map((t) => t.id);
  const periodiek = doc.taken.filter((t) => t.type === 'periodiek').map((t) => t.id);
  const opruimen = doc.taken.filter((t) => t.type === 'indien_nodig').map((t) => t.id);

  // Zes weken historie, met wisselende resultaten en een gewerkte ochtend.
  let week = { jaar: nu.jaar, weeknummer: nu.weeknummer };
  const eerdere = [];
  for (let i = 0; i < 6; i++) {
    week = vorigeWeek(week.jaar, week.weeknummer);
    eerdere.unshift(week);
  }

  eerdere.forEach((w, index) => {
    const sleutel = weekSleutel(w.jaar, w.weeknummer);
    // Om de week ook een periodieke taak erbij, zodat "hoelang geleden" iets laat zien.
    const taken = index % 2 === 0 ? [...wekelijks, periodiek[index % periodiek.length]] : [...wekelijks];
    bewerkingen.push({ soort: 'week.taken', week: sleutel, taakIds: taken });

    // Bijna alles gedaan, maar niet alles — dat is realistischer dan 100%.
    // Opruimtaken komen er vanzelf bij; die krijgen een resultaat in plaats van een vinkje.
    opruimen.forEach((taakId, n) => {
      bewerkingen.push({
        soort: 'weektaak.resultaat', week: sleutel, taakId,
        resultaat: (n + index) % 3 === 0 ? 'zelf_gedaan' : 'was_al_gedaan',
        tijd: tijdIn(w.jaar, w.weeknummer, 1, 9, 5 + n),
      });
    });

    taken.forEach((taakId, n) => {
      if ((n + index) % 9 === 0) return;
      bewerkingen.push({
        soort: 'weektaak.afvinken', week: sleutel, taakId, afgevinkt: true,
        tijd: tijdIn(w.jaar, w.weeknummer, 1, 9 + Math.floor(n / 8), (n * 7) % 60),
      });
    });

    bewerkingen.push({
      soort: 'bezoek.start', week: sleutel, id: `bz-${index}`,
      tijd: tijdIn(w.jaar, w.weeknummer, 1, 9, 0),
      schoonmakerId: index % 3 === 0 ? 'sm-fatima' : 'sm-anna',
    });
    bewerkingen.push({
      soort: 'bezoek.stop', week: sleutel, id: `bz-${index}`,
      tijd: tijdIn(w.jaar, w.weeknummer, 1, index % 2 === 0 ? 12 : 11, 30),
    });
  });

  // Deze week: gepland, notitie, en een paar dingen al gedaan.
  const dezeWeek = weekSleutel(nu.jaar, nu.weeknummer);
  const extra = doc.taken.find((t) => t.titel.includes('Vensterbank'));
  const planning = [...wekelijks, ...(extra ? [extra.id] : [])];
  bewerkingen.push({ soort: 'week.taken', week: dezeWeek, taakIds: planning });
  bewerkingen.push({
    soort: 'week.notitie', week: dezeWeek,
    notitie: 'Deze week graag extra aandacht voor de vensterbanken in de sportkamer. Denk aan het laminaat: nevelvochtig dweilen, niet nat.',
  });

  planning.slice(0, 3).forEach((taakId, n) => {
    bewerkingen.push({
      soort: 'weektaak.afvinken', week: dezeWeek, taakId, afgevinkt: true,
      tijd: tijdIn(nu.jaar, nu.weeknummer, 1, 9, 20 + n * 12),
    });
  });
  bewerkingen.push({
    soort: 'weektaak.opmerking', week: dezeWeek, taakId: planning[1],
    opmerking: 'De afvoer liep traag, er zit nu ontstopper in.',
  });

  bewerkingen.push({
    soort: 'bericht.maak',
    bericht: {
      id: nieuwId('b'), week: dezeWeek, afzender: 'schoonmaakster',
      tekst: 'De stofzuigerzak is bijna vol, ik kon geen reservezak vinden.',
      aangemaaktOp: tijdIn(nu.jaar, nu.weeknummer, 1, 10, 5), gelezen: false,
    },
  });
  bewerkingen.push({
    soort: 'bericht.maak',
    bericht: {
      id: nieuwId('b'), week: dezeWeek, afzender: 'beheerder',
      tekst: 'Nieuwe allesreiniger staat onder de gootsteen.',
      aangemaaktOp: tijdIn(nu.jaar, nu.weeknummer, 0, 18, 40), gelezen: true,
    },
  });

  return { ...speelAf(doc, bewerkingen), seedVersie: SEED_VERSIE };
}

/**
 * Zorgt dat er testgegevens klaarstaan. Nodig omdat een testlink ook rechtstreeks
 * geopend kan worden, zonder eerst langs de inrichtingspagina te gaan.
 * @returns {boolean} of er nu gevuld is
 */
export async function zorgVoorTestgegevens() {
  const bron = new LokaleBron('data');
  const stand = await bron.haal(null);
  const { documentNaarBestanden, bestandenNaarDocument } = await import('./opslag.js');

  if (Object.keys(stand.bestanden || {}).length) {
    // Al gevuld — maar is het nog de huidige bibliotheek?
    let versie = null;
    try {
      versie = bestandenNaarDocument(stand.bestanden).seedVersie ?? null;
    } catch {
      versie = null; // beschadigd: dan opnieuw vullen
    }
    if (versie === SEED_VERSIE) return false;
    // Voorbeeldgegevens zijn er om weggegooid te worden; verse versie erin.
    new LokaleBron('fotos').wis();
  }

  await bron.schrijf(documentNaarBestanden(maakTestDocument()));
  return true;
}

export { alsDatumTekst };
