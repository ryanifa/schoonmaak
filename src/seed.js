import { db, nu, inTransactie } from './db.js';

// Voorbeeldbibliotheek voor een rijtjeshuis. Wordt alleen gebruikt als de
// database nog leeg is; daarna schaaf je hem bij in de beheerdersweergave.
const RUIMTES = [
  'Keuken',
  'Woonkamer',
  'Hal',
  'Toilet',
  'Trap',
  'Badkamer',
  'Slaapkamer voor',
  'Slaapkamer achter',
  'Algemeen',
];

const W = 'wekelijks';
const TW = 'tweewekelijks';
const M = 'maandelijks';
const I = 'incidenteel';

const TAKEN = [
  ['Keuken', 'Aanrecht en tegelwand', 'Alles van het aanrecht af, afnemen met allesreiniger, daarna droogwrijven. Ook de tegels achter het aanrecht — vooral bij het fornuis.', W, 10],
  ['Keuken', 'Kookplaat en afzuigkap', 'Kookplaat ontvetten. Buitenkant afzuigkap afnemen; het filter hoeft alleen als het zichtbaar vet is.', W, 10],
  ['Keuken', 'Spoelbak en kraan', 'Spoelbak schuren met schuurmiddel, kraan natrekken zodat hij glimt. Ook de afvoerrand.', W, 5],
  ['Keuken', 'Buitenkant kastjes en handgrepen', 'Vochtig doekje met allesreiniger, met name rond de handgrepen en onder de bovenkastjes.', TW, 10],
  ['Keuken', 'Koelkast van buiten', 'Deur en handgreep afnemen, vingerafdrukken weg.', TW, 5],
  ['Keuken', 'Binnenkant magnetron en oven', 'Magnetron van binnen uitnemen, oven alleen de glasdeur tenzij er iets is overgekookt.', M, 15],
  ['Keuken', 'Prullenbak schoonmaken', 'Zak eruit, bak van binnen en buiten afnemen, nieuwe zak erin.', W, 5],
  ['Keuken', 'Vloer stofzuigen en dweilen', 'Eerst stofzuigen, ook onder de tafel en langs de plinten. Dweilen met een scheutje allesreiniger.', W, 10],

  ['Woonkamer', 'Stofvrij maken oppervlakken', 'Kast, tv-meubel, salontafel en vensterbanken. Spullen even optillen, niet eromheen poetsen.', W, 15],
  ['Woonkamer', 'Stofzuigen inclusief onder de bank', 'Ook de hoeken en langs de plinten. Kussens even oplichten.', W, 15],
  ['Woonkamer', 'Vloer dweilen', 'Na het stofzuigen, met een goed uitgewrongen mop. Niet te nat op de houten vloer.', W, 10],
  ['Woonkamer', 'Bank en kussens opfrissen', 'Kruimels uit de naden zuigen met het smalle mondstuk, kussens opschudden.', TW, 10],
  ['Woonkamer', 'Deuren en lichtknopjes', 'Vooral rond de klinken en de schakelaars — daar zitten de meeste vingers aan.', TW, 10],
  ['Woonkamer', 'Ramen aan de binnenkant', 'Glasreiniger en een droge doek. Ook de vensterbank eronder.', M, 25],
  ['Woonkamer', 'Planten afstoffen en water geven', 'Bladeren voorzichtig afnemen met een vochtig doekje.', TW, 10],

  ['Hal', 'Vloer stofzuigen en dweilen', 'Ook onder de kapstok en de deurmat uitkloppen.', W, 10],
  ['Hal', 'Voordeur en kozijn binnenkant', 'Deur, klink en brievenbus afnemen.', TW, 5],
  ['Hal', 'Meterkastdeur en plinten', 'Stof en vegen weg.', M, 5],

  ['Toilet', 'Pot van binnen en buiten', 'Toiletreiniger onder de rand, laten intrekken, daarna borstelen. Buitenkant, bril en scharnieren met een apart doekje.', W, 10],
  ['Toilet', 'Fonteintje en kraan', 'Kalkaanslag met azijnreiniger.', W, 5],
  ['Toilet', 'Vloer en tegels', 'Vooral achter en naast de pot goed meenemen.', W, 10],
  ['Toilet', 'Toiletborstel vervangen of uitspoelen', 'Houder legen en omspoelen.', M, 5],

  ['Trap', 'Traptreden stofzuigen', 'Met het smalle mondstuk, ook de hoekjes van de treden.', W, 10],
  ['Trap', 'Trapleuning en spijlen', 'Leuning afnemen met een vochtig doekje.', TW, 10],

  ['Badkamer', 'Douchewand en tegels', 'Wand met glasreiniger of azijn tegen kalk, daarna droogtrekken met de trekker. Tegels tot schouderhoogte.', W, 15],
  ['Badkamer', 'Douchebak en afvoer', 'Afvoerputje leeghalen (haren!) en schoonmaken.', W, 10],
  ['Badkamer', 'Wastafel, kraan en spiegel', 'Kalk weg bij de kraan, spiegel streeploos.', W, 10],
  ['Badkamer', 'Vloer en plinten', 'Stofzuigen en dweilen, ook achter de wc-borstel en onder de wastafel.', W, 10],
  ['Badkamer', 'Handdoeken verschonen', 'Schone handdoeken uit de kast, gebruikte in de wasmand.', W, 5],
  ['Badkamer', 'Voegen bijwerken tegen schimmel', 'Schimmelspray op de zwarte plekjes, 10 minuten laten staan, naspoelen.', M, 20],
  ['Badkamer', 'Wasmachine rand en zeepbakje', 'Rubberen rand droogwrijven, zeepbakje uitspoelen.', M, 10],

  ['Slaapkamer voor', 'Bed verschonen', 'Beddengoed ligt klaar in de kast. Oude lakens in de wasmand.', TW, 10],
  ['Slaapkamer voor', 'Stofzuigen en stofvrij maken', 'Nachtkastjes, vensterbank en onder het bed.', W, 15],
  ['Slaapkamer voor', 'Vloer dweilen', 'Alleen als de vloer zichtbaar vies is.', TW, 10],
  ['Slaapkamer voor', 'Spiegel en kastdeuren', 'Vingerafdrukken van de kastdeuren.', M, 10],

  ['Slaapkamer achter', 'Bed verschonen', 'Beddengoed ligt klaar in de kast.', TW, 10],
  ['Slaapkamer achter', 'Stofzuigen en stofvrij maken', 'Ook onder het bureau en achter de deur.', W, 15],
  ['Slaapkamer achter', 'Bureau opgeruimd afnemen', 'Niets weggooien, alleen stof en kringen weg.', TW, 5],

  ['Algemeen', 'Was draaien en ophangen', 'Wasmand in de badkamer. Programma staat op het kaartje bij de machine.', W, 15],
  ['Algemeen', 'Plinten in het hele huis', 'Vochtig doekje langs de plinten, kamer voor kamer.', M, 30],
  ['Algemeen', 'Deurposten en bovenkant deuren', 'Daar ligt het meeste stof en dat zie je pas in de zon.', M, 20],
  ['Algemeen', 'Radiatoren stoffen', 'Met de smalle stofzuigermond tussen de ribben.', M, 15],
  ['Algemeen', 'Ramen aan de buitenkant', 'Alleen de begane grond, en alleen als het weer het toelaat.', I, 40],
  ['Algemeen', 'Gordijnen en vitrage wassen', 'In overleg — laat het even weten voordat je begint.', I, 30],
];

export function seedIndienLeeg() {
  const aantal = db.prepare('SELECT COUNT(*) AS n FROM taken').get().n;
  if (aantal > 0) return false;

  inTransactie(() => {
    const tijd = nu();
    const ruimteIn = db.prepare('INSERT INTO ruimtes (naam, volgorde, actief) VALUES (?, ?, 1)');
    const ruimteIds = new Map();
    RUIMTES.forEach((naam, i) => {
      ruimteIds.set(naam, ruimteIn.run(naam, i).lastInsertRowid);
    });

    const taakIn = db.prepare(`
      INSERT INTO taken (titel, ruimte_id, omschrijving, standaard_frequentie, geschatte_minuten, volgorde, actief, aangemaakt_op)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const volgordePerRuimte = new Map();
    for (const [ruimte, titel, omschrijving, frequentie, minuten] of TAKEN) {
      const v = volgordePerRuimte.get(ruimte) ?? 0;
      volgordePerRuimte.set(ruimte, v + 1);
      taakIn.run(titel, ruimteIds.get(ruimte), omschrijving, frequentie, minuten, v, tijd);
    }
  });
  return true;
}
