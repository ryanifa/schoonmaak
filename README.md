# Schoonmaak

Een kleine weekplanner voor de huishoudelijke hulp. De beheerder stelt per week samen
wat er gedaan moet worden; de schoonmaakster ziet op haar telefoon wát ze moet doen,
met een voorbeeldfoto erbij, en vinkt af.

Eén huishouden, één schoonmaakster. Geen accounts, geen registratie — twee geheime links.

## In het kort

| | |
|---|---|
| Beheerdersweergave | takenbibliotheek met foto's, week samenstellen, historie, berichten |
| Schoonmaakweergave | mobiel-first weeklijst met afvinken, opmerkingen en berichten |
| Techniek | Node.js 22, SQLite (ingebouwd), vanilla JavaScript — **nul npm-dependencies** |
| Opslag | één SQLite-bestand, foto's inbegrepen |

## Snel starten

```bash
node --version          # 22.5 of nieuwer (voor de ingebouwde SQLite)
cp .env.example .env    # en vul er eigen tokens in
npm start
```

De app print bij het opstarten de twee links:

```
  Beheer:      http://localhost:3000/beheer/<beheer-token>
  Schoonmaak:  http://localhost:3000/schoonmaak/<schoonmaak-token>
```

Bij de eerste start wordt de database gevuld met een voorbeeldbibliotheek voor een
rijtjeshuis: keuken, woonkamer, hal, toilet, trap, badkamer, twee slaapkamers en
algemene taken. Ongeveer veertig taken met omschrijving, frequentie en tijdsinschatting —
bedoeld om bij te schaven, niet om precies zo te gebruiken.

## Configuratie

Alles via omgevingsvariabelen (of een `.env`-bestand naast `package.json`).

| Variabele | Standaard | Betekenis |
|---|---|---|
| `PORT` | `3000` | Poort waarop de app luistert |
| `DATA_DIR` | `./data` | Map met de database. **Moet persistent zijn.** |
| `BEHEER_TOKEN` | willekeurig | Geheim deel van de beheerlink |
| `SCHOONMAAK_TOKEN` | willekeurig | Geheim deel van de schoonmaaklink |
| `PINCODE` | leeg (uit) | Optionele extra toegangscode |

Een nieuw token maken:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Zet je `BEHEER_TOKEN` en `SCHOONMAAK_TOKEN` niet, dan genereert de app ze één keer en
bewaart ze in `DATA_DIR`, zodat de links na een herstart blijven werken. Handig om te
proberen; voor echt gebruik zet je ze zelf, dan kun je ze wisselen als een link uitlekt.

**Pincode.** Is `PINCODE` gezet, dan vraagt de app die code één keer en onthoudt hem in
`localStorage`. De server controleert de code bij elk verzoek — het is dus een echt slot,
geen schermpje ervoor. Leeg laten schakelt het uit.

## Draaien in productie

De enige harde eis is dat `DATA_DIR` een schijf is die blijft bestaan. Een
platform zonder persistente schijf (de meeste "serverless" hosts) is niet geschikt:
je raakt bij elke deploy alle taken en foto's kwijt.

**Docker**

```bash
docker build -t schoonmaak .
docker run -d --name schoonmaak -p 3000:3000 \
  -v schoonmaak-data:/data \
  -e BEHEER_TOKEN=... -e SCHOONMAAK_TOKEN=... \
  schoonmaak
```

Of met `docker compose up -d` (zie `docker-compose.yml`).

**Fly.io** — `fly.toml` staat klaar:

```bash
fly launch --no-deploy
fly volumes create schoonmaak_data --region ams --size 1
fly secrets set BEHEER_TOKEN=... SCHOONMAAK_TOKEN=...
fly deploy
```

**Eigen server** — `npm start` achter een reverse proxy met HTTPS. De tokens staan in de
URL, dus HTTPS is geen overbodige luxe.

Back-up maken is één bestand kopiëren: `DATA_DIR/schoonmaak.db` (met `-wal` en `-shm`
erbij als de app draait, of gewoon even stoppen).

## Hoe het in elkaar zit

```
src/
  config.js        omgevingsvariabelen, tokens, rolbepaling
  db.js            SQLite-schema en migraties
  seed.js          voorbeeldbibliotheek voor een rijtjeshuis
  repo.js          datalaag — kent geen HTTP en geen UI
  api.js           routetabel: verzoek in, JSON uit
  server.js        HTTP-server, statische bestanden, toegang
  util/week.js     ISO-weeknummers
public/
  schoonmaak.html  de weeklijst
  beheer.html      beheer met vier tabbladen
  js/api.js        fetch + wachtrij die slecht netwerk overleeft
  js/util.js       DOM-hulpjes, Nederlandse datums, foto verkleinen
  css/app.css      alle vormgeving
```

Het datamodel staat los van de UI: `repo.js` is puur data, `api.js` vertaalt HTTP naar
die datalaag, en de browser praat alleen met de JSON-API. Een tweede huishouden of een
mobiele app erbij bouwen raakt daardoor alleen de randen.

### Datamodel

- **Ruimte** — Keuken, Badkamer, … Beheerbaar, herordenbaar, archiveerbaar.
- **Taak** — hoort bij een ruimte; titel, omschrijving, één foto, standaardfrequentie,
  geschatte minuten, volgorde, actief.
- **Week** — ISO-jaar + weeknummer, startdatum, notitie van de beheerder.
- **Weektaak** — koppeling week ↔ taak, met `afgevinkt`, `afgevinktOp` en `opmerking`.
- **Bericht** — algemene meldingen ("de stofzuiger is stuk"), met gelezen-markering.

De takenbibliotheek en de weeklijst staan bewust los van elkaar: niet elke taak hoeft
elke week. Een taak archiveren of hernoemen laat de historie intact.

## Slecht netwerk

Afvinken mag niet stilletjes mislukken. Schrijfacties gaan daarom door een wachtrij:

- de UI reageert meteen, het verzoek gaat op de wachtrij;
- lukt het, dan verschijnt kort **Opgeslagen**;
- lukt het niet, dan blijft **Nog niet opgeslagen** in beeld staan mét een knop
  *Opnieuw*, en probeert de app het zelf opnieuw met oplopende tussenpozen;
- de wachtrij staat in `localStorage` en overleeft dus het sluiten van de pagina;
- zodra het netwerk terug is (of het tabblad weer zichtbaar wordt) gaat het vanzelf door.

Per taak telt alleen de laatste stand, dus drie keer aan-en-uit tikken levert één verzoek
op. Afvinken en opmerkingen zijn idempotent; berichten hebben een `clientId` zodat een
herhaalde verzending geen dubbel bericht oplevert.

## Foto's

De browser verkleint een foto naar maximaal 1400 pixels en comprimeert hem tot JPEG
voordat er iets verstuurd wordt — een kiekje van 4 MB wordt zo een bestand van een paar
honderd kilobyte. De server slaat hem op in de database en serveert hem met een lange
cache-header, zodat een foto op de telefoon maar één keer geladen hoeft te worden.
Foto's zijn alleen bereikbaar mét geldig token.

## Testen

```bash
npm test
```

27 tests: ISO-weeklogica (inclusief jaren met 53 weken), de datalaag (afvinkjes die
bewaard blijven als de weeklijst verandert, "hoe lang geleden", kopiëren van de vorige
week) en de HTTP-API (rolscheiding, foto-upload, validatie, pincode, geen uitbraak uit
de `public`-map).

## Bewust niet gebouwd

Meerdere huishoudens, urenregistratie, notificaties, foto's als bewijs achteraf, en het
automatisch genereren van de weeklijst op basis van frequentie. De structuur staat het
toe — `standaardFrequentie` en de historie per taak liggen er al voor klaar.
