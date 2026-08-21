# Schoonmaak

Een kleine weekplanner voor de huishoudelijke hulp. De beheerder stelt per week
samen wat er gedaan moet worden; de schoonmaakster ziet op haar telefoon wát ze
moet doen, met een voorbeeldfoto erbij, en vinkt af.

Eén huishouden, één schoonmaakster. Geen accounts, geen registratie, geen server:
de app draait op GitHub Pages en bewaart alles in twee Gists.

## Hoe het draait

| | |
|---|---|
| Hosting | GitHub Pages, gepubliceerd vanuit `main` door GitHub Actions |
| Opslag | twee geheime Gists — één voor de gegevens, één voor de foto's |
| Techniek | vanilla JavaScript, **geen enkele dependency**, geen bouwstap |
| Op de telefoon | PWA: op het beginscherm te zetten en bruikbaar zonder bereik |

Er is dus niets om te draaien of te betalen. De enige twee dingen die je zelf
instelt zijn hieronder beschreven.

## Eenmalig instellen

**1. Zet GitHub Pages aan.** Repo → *Settings* → *Pages* → bij **Source** kies je
**GitHub Actions**. Meer niet. Er komt geen `gh-pages`-branch: de workflow
publiceert rechtstreeks, alles blijft op `main`.

Na de eerste push staat de app op `https://<gebruiker>.github.io/schoonmaak/`.

**2. Maak een sleutel.** Ga naar
[GitHub → fine-grained token](https://github.com/settings/personal-access-tokens/new)
en zet bij **Account permissions → Gists** de waarde op **Read and write**. Verder
heeft de app niets nodig; laat alle andere rechten uit staan.

Open daarna de app, plak de sleutel, en klik op *Gists aanmaken en beginnen*. De
app maakt de twee Gists, vult de takenbibliotheek met 44 voorbeeldtaken voor een
rijtjeshuis, en geeft je twee links:

- **beheer** — voor jou: bibliotheek, weeklijst, historie, berichten;
- **schoonmaak** — voor haar telefoon.

## Over de sleutel in de link

Er is geen server, dus haar telefoon praat rechtstreeks met GitHub. Om een
afvinkje te kunnen opslaan heeft dat toestel een sleutel nodig, en die zit
daarom in haar link verwerkt.

Dat betekent iets, en het is eerlijker om het gewoon op te schrijven: **wie die
link heeft, kan bij de Gists van het account waar de sleutel bij hoort.** Niet bij
je repositories, niet bij je instellingen — alleen bij Gists, en alleen als je de
sleutel beperkt houdt zoals hierboven beschreven.

Wat dat draaglijk maakt:

- de sleutel staat achter het `#` in de link, en dat deel wordt door browsers
  nooit naar een server gestuurd — het staat niet in serverlogboeken;
- de app haalt de sleutel meteen na het openen uit de adresbalk, zodat hij niet
  in de geschiedenis of op een schermafbeelding blijft staan;
- is er iets mis, dan trek je de sleutel in bij GitHub en maak je een nieuwe. De
  Gists blijven bestaan; koppel ze weer via *bestaande Gists gebruiken*.

Wil je het strakker: maak een apart, gratis GitHub-account dat alleen deze Gists
bezit, en gebruik daarvan de sleutel. Voor haar verandert er niets — het blijft
één tik op een link.

## Op de telefoon zetten

Ze opent de link één keer. Daarna: *Delen → Zet op beginscherm* (iPhone) of
*Menu → App installeren* (Android). Vanaf dat moment opent hij als een app,
zonder adresbalk, en ook zonder bereik.

## Wat er in de app zit

**Beheer** — takenbibliotheek per ruimte met foto's, standaardfrequentie en
tijdsinschatting; taken toevoegen, bewerken, herordenen en archiveren; ruimtes
beheren. Week samenstellen met per taak **hoeveel weken geleden die voor het
laatst gedaan is**, snelknoppen (kopieer vorige week, alles wekelijks, alles uit)
en een notitieveld. Historie per week en per taak, plus alle opmerkingen en
berichten met een ongelezen-markering.

**Schoonmaak** — de week en de notitie bovenaan, een voortgangsbalk, taken
gegroepeerd per ruimte, grote tikbare rijen, de foto schermvullend te bekijken,
een opmerking per taak en een knop om een bericht achter te laten. Afvinken slaat
direct op, met tijdstempel, en kan ongedaan gemaakt worden.

## Slecht netwerk

Ze staat te poetsen in een huis waar de wifi niet overal komt. Daarom:

- de app zelf staat op het toestel (service worker) en opent dus altijd;
- de laatst bekende weeklijst staat in de browseropslag, dus ook zonder bereik
  ziet ze meteen wat er te doen is;
- afvinken werkt gewoon door en komt in een wachtrij die het sluiten van de app
  overleeft;
- lukt opslaan niet, dan blijft **Nog niet opgeslagen** in beeld staan met een
  knop *Opnieuw* — het mislukt nooit stilletjes;
- zodra er weer verbinding is, gaat het vanzelf door.

## Hoe het synchroniseren werkt

Een Gist kent geen "schrijf alleen als er niets veranderd is". Twee apparaten die
tegelijk opslaan zouden elkaar dus kunnen overschrijven. De app lost dat zo op:

1. Elke wijziging is een **bewerking** — een klein objectje als
   `{soort: 'weektaak.afvinken', week: '2026-34', taakId: …, afgevinkt: true}` —
   dat meteen lokaal wordt toegepast en in een wachtrij gaat.
2. Bij het opslaan haalt de app eerst de **verse** inhoud van de Gist op en
   speelt de wachtrij daar bovenop af. Wat de ander intussen deed, blijft dus staan.
3. Na het schrijven controleert de app met de ETag of er tóch nog iemand
   tussendoor kwam. Zo ja, dan wordt de wachtrij op die nieuwe stand opnieuw
   afgespeeld.

Elke bewerking geeft bij herhaling hetzelfde resultaat, dus opnieuw afspelen is
altijd veilig. Zo overleeft een afvinkje op de telefoon een notitie die op
hetzelfde moment op de laptop wordt getypt — daar is een test voor.

De gegevens staan in drie losse bestanden (bibliotheek, weken, berichten), zodat
een wijziging alleen het bestand raakt waar hij bij hoort.

**Foto's** staan in een eigen Gist, één bestand per foto. Een foto verandert
nooit — een vervangen foto krijgt een nieuw id — dus zodra een toestel ze heeft,
blijven ze in IndexedDB staan en gaat er niets meer over de lijn. De browser
verkleint een foto naar maximaal 1100 pixels voordat er iets verstuurd wordt; een
kiekje van 4 MB wordt zo een bestand van enkele tientallen kilobytes.

## Hoe het in elkaar zit

```
app/
  index.html          inrichten: sleutel, Gists, de twee links
  beheer.html         beheer met vier tabbladen
  schoonmaak.html     de weeklijst
  sw.js               service worker (de app offline beschikbaar)
  js/
    document.js       het datamodel en alle bewerkingen — puur, geen netwerk of DOM
    week.js           ISO-weeknummers
    seed.js           voorbeeldbibliotheek voor een rijtjeshuis
    gist.js           de enige plek die van de GitHub-API weet
    opslag.js         document, wachtrij, samenvoegen en wegschrijven
    fotos.js          foto-Gist met IndexedDB ernaast
    config.js         toegang uit de link, opslaan, adresbalk opschonen
    beheer.js         de beheerdersweergave
    schoonmaak.js     de schoonmaakweergave
    util.js melding.js modaal.js fotoscherm.js status.js pwa.js
  css/app.css
```

`document.js` weet niets van GitHub of van de browser: het zijn pure functies van
document plus bewerking naar nieuw document. Daardoor is het datamodel los te
testen en later uit te breiden.

## Testen

```bash
npm test        # 42 tests
npm run dev     # bekijk de app lokaal op http://localhost:4321
```

De tests draaien ook bij elke push; publiceren gebeurt alleen als ze slagen.

Wat ze afdekken: ISO-weeklogica inclusief jaren met 53 weken; alle bewerkingen op
het datamodel; en het synchroniseren tegen een **nagebouwde Gist-API**
(`test/nep-gist.js`) — gelijktijdig werken op telefoon en laptop, een wachtrij die
een herstart overleeft, offline openen, een verkeerde sleutel, een beschadigd
bestand in de Gist, en dat foto's maar één keer worden opgehaald.

Eén ding is bewust nagebootst en niet echt getest: de verzoeken naar
`api.github.com` zelf. Die zijn in deze omgeving niet bereikbaar. De app rekent
daarom nergens op onbewezen gedrag — als de ETag onverhoopt niet leesbaar is,
werkt alles nog steeds, alleen wordt er wat vaker gedownload. Ook daar is een
test voor.

## Bewust niet gebouwd

Meerdere huishoudens, urenregistratie, notificaties, foto's als bewijs achteraf,
en het automatisch samenstellen van de weeklijst op basis van frequentie. De
structuur staat het toe: `standaardFrequentie` en de historie per taak liggen er
al voor klaar.
