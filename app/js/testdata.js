/* Gevulde voorbeeldgegevens voor de testmodus: een bibliotheek, een paar weken
   historie en een week die half af is. Zo valt er meteen iets te zien en te doen. */

import { maakVoorbeeldDocument } from './seed.js';
import { speelAf, weekSleutel, nieuwId } from './document.js';
import { huidigeWeek, vorigeWeek, startdatumVanWeek, alsDatumTekst } from './week.js';

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
  const bewerkingen = [];

  const wekelijks = doc.taken.filter((t) => t.standaardFrequentie === 'wekelijks').map((t) => t.id);
  const tweewekelijks = doc.taken.filter((t) => t.standaardFrequentie === 'tweewekelijks').map((t) => t.id);

  // Zes weken historie, met wisselende resultaten en een gewerkte ochtend.
  let week = { jaar: nu.jaar, weeknummer: nu.weeknummer };
  const eerdere = [];
  for (let i = 0; i < 6; i++) {
    week = vorigeWeek(week.jaar, week.weeknummer);
    eerdere.unshift(week);
  }

  eerdere.forEach((w, index) => {
    const sleutel = weekSleutel(w.jaar, w.weeknummer);
    const taken = index % 2 === 0 ? [...wekelijks, ...tweewekelijks] : [...wekelijks];
    bewerkingen.push({ soort: 'week.taken', week: sleutel, taakIds: taken });

    // Bijna alles gedaan, maar niet alles — dat is realistischer dan 100%.
    taken.forEach((taakId, n) => {
      if ((n + index) % 9 === 0) return;
      bewerkingen.push({
        soort: 'weektaak.afvinken', week: sleutel, taakId, afgevinkt: true,
        tijd: tijdIn(w.jaar, w.weeknummer, 1, 9 + Math.floor(n / 8), (n * 7) % 60),
      });
    });

    bewerkingen.push({ soort: 'bezoek.start', week: sleutel, id: `bz-${index}`, tijd: tijdIn(w.jaar, w.weeknummer, 1, 9, 0) });
    bewerkingen.push({
      soort: 'bezoek.stop', week: sleutel, id: `bz-${index}`,
      tijd: tijdIn(w.jaar, w.weeknummer, 1, index % 2 === 0 ? 12 : 11, 30),
    });
  });

  // Deze week: gepland, notitie, en een paar dingen al gedaan.
  const dezeWeek = weekSleutel(nu.jaar, nu.weeknummer);
  const ramen = doc.taken.find((t) => t.titel.includes('Ramen aan de binnenkant'));
  const planning = [...wekelijks, ...(ramen ? [ramen.id] : [])];
  bewerkingen.push({ soort: 'week.taken', week: dezeWeek, taakIds: planning });
  bewerkingen.push({
    soort: 'week.notitie', week: dezeWeek,
    notitie: 'Deze week graag extra aandacht voor de vensterbanken. De ramen in de woonkamer zijn al een tijd niet aan de beurt geweest.',
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

  return speelAf(doc, bewerkingen);
}

export { alsDatumTekst };
