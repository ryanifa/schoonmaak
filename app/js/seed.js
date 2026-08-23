/* De takenbibliotheek van dit huis: een eengezinswoning over drie woonlagen
   plus dakkamer. Wordt eenmalig gebruikt bij het inrichten; daarna schaaf je
   hem bij in de beheerdersweergave.

   Volgorde van de ruimtes volgt een rondje door het huis: eerst beneden, dan de
   trap op, en als laatste de dakkamer. */

import { nieuwId } from './document.js';

const RUIMTES = [
  'Keuken',
  'Woonkamer',
  'Hal en trap',
  'Overloop',
  'Badkamer',
  'Sportkamer',
  'Studeerkamer',
  'Slaapkamer',
  'Trap naar dakkamer',
  'Dakkamer',
];

const W = 'wekelijks';
const P = 'periodiek';
const N = 'indien_nodig';

// Laminaat verdraagt geen natte mop. Deze zin staat bij elke laminaatvloer.
const LAMINAAT = 'Laminaat alleen nevelvochtig dweilen: mop goed uitwringen, er mag geen water op blijven staan.';

// [ruimte, titel, type, omschrijving, minuten, frequentiehint (alleen bij periodiek)]
const TAKEN = [
  ['Keuken', 'Keuken opruimen', N,
    'Vaat in de vaatwasser, spullen terug op hun plek, aanrecht leeg. Pas als het opgeruimd is, kun je goed schoonmaken.', 10],
  ['Keuken', 'Aanrecht en werkbladen schoonmaken', W,
    'Alles eraf, afnemen met allesreiniger en daarna droogwrijven. Ook de spatwand achter het aanrecht meenemen.', 10],
  ['Keuken', 'Inductiekookplaat schoonmaken', W,
    'Laat de plaat eerst afkoelen. Afnemen met een vochtige doek; ingebrande vlekken met de glasschraper. Geen schuurspons — dat maakt krassen op het glas.', 10],
  ['Keuken', 'Vuilnisbakken legen', W,
    'Zak eruit, bak van binnen en buiten afnemen, nieuwe zak erin.', 5],
  ['Keuken', 'Keukenkastjes (fronten) schoonmaken', P,
    'Vochtig doekje met allesreiniger, met name rond de handgrepen en aan de onderkant van de bovenkastjes.', 15, 'maandelijks'],
  ['Keuken', 'Glas van de oven schoonmaken', P,
    'Binnen- en buitenkant van het ovenglas. Ovenreiniger even laten intrekken en daarna goed naspoelen.', 15, 'maandelijks'],

  ['Woonkamer', 'Eettafel schoonmaken', W,
    'Afnemen en droogwrijven. Ook de randen en de poten als daar kliederen op zitten.', 5],
  ['Woonkamer', 'Planten water geven', W,
    'Voelen of de aarde droog is; alleen water geven als dat zo is. Geen laagje water in de pot laten staan.', 10],
  ['Woonkamer', 'Vloer keuken en woonkamer dweilen', W,
    `Eerst stofzuigen, ook langs de plinten en onder de tafel. Keuken en woonkamer lopen in elkaar over: dit is één vloer. In de woonkamer ligt zeil, in het keukengedeelte laminaat. ${LAMINAAT}`, 20],

  ['Hal en trap', 'Gang stofzuigen en dweilen', W,
    `Ook onder de kapstok, en de deurmat even uitkloppen. ${LAMINAAT}`, 10],
  ['Hal en trap', 'Trap naar eerste verdieping stofzuigen', W,
    'Met het smalle mondstuk, ook de hoekjes van de treden en de randen langs de muur.', 10],

  ['Overloop', 'Overloop stofzuigen en dweilen', W,
    `Ook de hoeken en langs de plinten. ${LAMINAAT}`, 10],

  ['Badkamer', 'Badkamer opruimen', N,
    'Spullen terug in de kast, handdoeken op hun plek, wasgoed in de mand. Pas dan kun je goed schoonmaken.', 10],
  ['Badkamer', 'Toilet schoonmaken', W,
    'Toiletreiniger onder de rand, even laten intrekken en daarna borstelen. Bril, deksel, scharnieren en de buitenkant met een apart doekje.', 10],
  ['Badkamer', 'Douche, wastafel en kranen schoonmaken', W,
    'Kalkaanslag op de wand en de kranen met azijnreiniger; wand daarna droogtrekken met de trekker. Afvoerputje leeghalen (haren). Spiegel streeploos.', 20],
  ['Badkamer', 'Vloer dweilen', W,
    'Eerst stofzuigen. Vooral achter en naast het toilet en onder de wastafel goed meenemen.', 10],

  ['Sportkamer', 'Sportkamer opruimen', N,
    'Matten, gewichten en materiaal terug op hun plek, zodat de vloer vrij is.', 10],
  ['Sportkamer', 'Vloer stofzuigen en dweilen', W,
    `Ook onder en achter de toestellen. ${LAMINAAT}`, 10],
  ['Sportkamer', 'Vensterbank schoonmaken', P,
    'Spullen eraf, vochtig doekje, daarna droog. Ook de rand van het kozijn.', 10, 'maandelijks'],

  ['Studeerkamer', 'Vloer stofzuigen en dweilen', W,
    `Ook onder het bureau en achter de deur. ${LAMINAAT}`, 10],
  ['Studeerkamer', 'Kastjes afstoffen', P,
    'Bovenkant en fronten van de kastjes. Niets verplaatsen wat er niet af hoeft.', 10, 'maandelijks'],

  ['Slaapkamer', 'Bed opmaken', N,
    'Dekbed opschudden en rechtleggen, kussens goed. Alleen als het nog niet gedaan is.', 5],
  ['Slaapkamer', 'Vloer stofzuigen en dweilen', W,
    `Ook onder het bed en langs de plinten. ${LAMINAAT}`, 10],

  ['Trap naar dakkamer', 'Trap stofzuigen en dweilen', W,
    `Met het smalle mondstuk, ook de hoekjes van de treden. ${LAMINAAT}`, 10],

  ['Dakkamer', 'Keukentje opruimen', N,
    'Vaat weg, aanrechtje leeg, spullen terug op hun plek.', 5],
  ['Dakkamer', 'Keukentje schoonmaken', W,
    'Aanrechtje en spoelbakje afnemen, kraan natrekken, kastdeurtjes bij de handgrepen.', 10],
  ['Dakkamer', 'Vloer stofzuigen en dweilen', W,
    `Ook de hoeken onder het schuine dak. ${LAMINAAT}`, 10],
  ['Dakkamer', 'Plant water geven', W,
    'Voelen of de aarde droog is; alleen dan water geven.', 5],
];

/** Bouwt een compleet startdocument met ruimtes en taken. */
export function maakVoorbeeldDocument() {
  const ruimteIds = new Map();
  const ruimtes = RUIMTES.map((naam, i) => {
    const id = nieuwId('r');
    ruimteIds.set(naam, id);
    return { id, naam, volgorde: i, actief: true };
  });

  const volgordePerRuimte = new Map();
  const taken = TAKEN.map(([ruimte, titel, type, omschrijving, geschatteMinuten, frequentie]) => {
    const volgorde = volgordePerRuimte.get(ruimte) ?? 0;
    volgordePerRuimte.set(ruimte, volgorde + 1);
    return {
      id: nieuwId('t'),
      titel,
      ruimteId: ruimteIds.get(ruimte),
      omschrijving,
      type,
      // De frequentie is alleen een hulpje bij periodieke taken.
      standaardFrequentie: frequentie || (type === 'wekelijks' ? 'wekelijks' : 'incidenteel'),
      geschatteMinuten,
      fotoId: null,
      volgorde,
      actief: true,
    };
  });

  return { versie: 1, ruimtes, taken, weken: {}, berichten: [] };
}

export const AANTAL_VOORBEELDTAKEN = TAKEN.length;

/**
 * Verandert zodra de bibliotheek wordt aangepast. De testmodus gebruikt dit om
 * verouderde voorbeeldgegevens te vervangen — anders zou je in een browser waar
 * je eerder hebt rondgekeken nog het oude huis zien.
 */
export const SEED_VERSIE = `${RUIMTES.length}-${TAKEN.length}-${TAKEN.map((t) => t[1]).join('|').length}`;
