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

## Eerst even rondkijken zonder sleutel

Op de openingspagina staat **Testmodus starten**. Daarmee draait de hele app —
inclusief een gevulde takenbibliotheek, zes weken historie en een week die half
af is — maar blijft alles in je browser. Er gaat niets naar GitHub, en je hebt er
geen sleutel voor nodig.

De testmodus gebruikt precies dezelfde code als het echte werk: dezelfde
wachtrij, dezelfde manier van samenvoegen. Alleen de plek waar de bestanden heen
gaan verschilt (`LokaleBron` in plaats van `GistBron`). Wat je in de testmodus
ziet werken, werkt straks ook echt.

Een oranje balk bovenin herinnert je eraan dat je in de testmodus zit. Op de
inrichtingspagina staat een knop om hem te verlaten en de testgegevens te wissen.

Je kunt ook rechtstreeks naar een van beide weergaven:

- schoonmaakster — `schoonmaak.html#c=eyJ4IjoxLCJyIjoic2Nob29ubWFha3N0ZXIifQ`
- beheer — `beheer.html#c=eyJ4IjoxLCJyIjoiYmVoZWVyZGVyIn0`

Zo'n link vult zichzelf: is er in die browser nog niets, dan zet de app de
voorbeeldgegevens alsnog klaar.

## Eenmalig instellen

**1. Zet de Pages-bron op GitHub Actions.** Repo → *Settings* → *Pages* → bij
**Source** kies je **GitHub Actions**.

Dit is belangrijk: staat de bron op *Deploy from a branch*, dan draait GitHub bij
elke push óók een Jekyll-build van de repo-root. Die publiceert de README in
plaats van de app, en omdat hij later klaar is dan deze workflow overschrijft hij
de publicatie. De workflow probeert de bron zelf om te zetten
(`configure-pages` met `enablement`), maar controleer het één keer.

Je herkent het meteen: draait er naast *Testen en publiceren* ook een run met de
naam *pages build and deployment*, dan staat de bron nog verkeerd.

Er komt geen `gh-pages`-branch bij — de workflow publiceert rechtstreeks, alles
blijft op `main`. Na de eerste geslaagde publicatie staat de app op
`https://<gebruiker>.github.io/schoonmaak/`.

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

**Beheer** — takenbibliotheek per ruimte met foto's, type, tijdsinschatting en
(bij periodieke taken) een frequentiehint; taken toevoegen, bewerken, herordenen
en archiveren; ruimtes beheren. Week samenstellen met per taak **hoeveel weken geleden die voor het
laatst gedaan is**, snelknoppen (kopieer vorige week, alles wekelijks, alles uit)
en een notitieveld. Historie per week en per taak, plus alle opmerkingen en
berichten met een ongelezen-markering.

### Berichten

Eén gesprek tussen jou en haar. Een bericht hangt intern aan een week — dat is
handig in jouw historie — maar dat bepaalt niet wat zij te zien krijgt: achter de
knop **💬 Berichten** staat alles wat er ooit over en weer gezegd is, oudste
boven, nieuwste onderaan.

Haar **opmerkingen bij taken** staan er vanzelf tussen, met de taak erbij ("bij
Badkamer — Douche schoonmaken"). Zo staat alles wat er gezegd is op één plek, in
de volgorde waarin het gezegd is, en hoeft zij zich niet af te vragen of ze iets
als bericht of als opmerking had achtergelaten.

Schrijf jij iets, dan staat er een rood telletje op haar knop tot ze het opent —
net zoals jij dat op het tabblad Berichten hebt. Dat telt alleen wat van de
ander komt.

> Opmerkingen hadden geen tijdstip; dat is er nu bij gekomen (`opmerkingOp`).
> Een opmerking van vóór deze versie valt terug op de startdatum van zijn week,
> zodat hij in elk geval op de goede plek in de tijd staat.

### Drie soorten taken

Naast ruimte heeft elke taak een **type**, en dat bepaalt het gedrag:

| Type | Gedrag |
|---|---|
| `wekelijks` | Staat standaard aan als je een week samenstelt |
| `periodiek` | Zet je zelf aan als hij aan de beurt is; je ziet erbij hoelang geleden het is gedaan |
| `indien_nodig` | Staat **standaard** op haar lijst, ook zonder dat je hem aanvinkt — maar je kunt hem wel uitzetten |

`indien_nodig` is voor opruimtaken. Normaal ruimt de bewoner zelf op, maar dat
lukt niet altijd, en in een rommelige kamer valt niet schoon te maken. Zij moet
dat dus zelf kunnen oppakken zonder te overleggen.

Ze staan er daarom vanzelf bij zolang je een week niet hebt samengesteld. Zodra
je de weeklijst aanraakt, telt jouw lijst: een opruimtaak die je wegklikt blijft
weg, ook bij haar. De app onthoudt per week welke taken je toen voor je had, dus
een opruimtaak die je later aanmaakt komt er alsnog vanzelf bij — die had je nog
niet beoordeeld.

#### Mag blijven liggen

Los van het type heeft elke taak een vinkje **Mag blijven liggen**. Dat is de
prioriteit: alles zonder vinkje moet deze week af, alles mét vinkje is wat er
als eerste afvalt als de tijd op is.

Zij ziet het als een grijs labeltje op haar lijst, midden in de looproute — de
volgorde per ruimte blijft dus zoals hij is, want één rondje door het huis is
sneller dan twee. Gaat het alarm af, dan staat er precies wat er nog moet en wat
ze mag laten liggen.

Daarom heeft zo'n taak twee knoppen in plaats van een vinkje: **Was al in orde**
en **Heb ik gedaan**. Allebei gelden als afgerond, maar het verschil blijft
bewaard. In de historie zie je per taak hoe vaak het echt nodig was — bijvoorbeeld
"in 7 weken: 4× al in orde, 2× door haar gedaan".

> De spec noemde deze knoppen "Was al opgeruimd" en "Heb ik opgeruimd". Dat leest
> raar bij *Bed opmaken*, dus ik heb het neutraler gemaakt. Andere woorden zijn
> zo weer aangepast in `app/js/schoonmaak.js`.

### Wie er werkt

In het beheer voeg je schoonmaaksters toe (Takenbibliotheek → **Schoonmaaksters**)
en wijs je er één als standaard aan. Staat er meer dan één, dan kiest zij bij het
starten haar naam; de standaard staat alvast voor, en op haar eigen toestel staat
haar vorige keuze voor. Is er niemand of maar één, dan valt er niets te kiezen en
begint ze meteen.

Wie er gewerkt heeft staat bij het bezoek, dus je ziet het per week terug in de
historie: *"Anna · dinsdag 18 augustus 9:00 – 11:30 (2 uur 30)"*. Archiveer je
iemand, dan verdwijnt ze uit haar keuzelijst maar houden oude bezoeken haar naam.

### Werktijd

**Schoonmaak** — bovenaan een grote knop **Ik begin**; daarna loopt de tijd mee
en staat er **Ik ben klaar**. Bij het afsluiten volgt een korte samenvatting:
hoelang er gewerkt is en hoeveel taken er af zijn. Meerdere keren op een week kan
gewoon; de tijden tellen bij elkaar op.

De kop toont de dag van vandaag ("Week 35 — woensdag 26 augustus"), niet de
maandag van de week: zij opent de lijst vandaag.

Verder: de week en de notitie bovenaan, een voortgangsbalk, taken gegroepeerd per
ruimte, grote tikbare rijen, de foto schermvullend te bekijken, een opmerking per
taak en een knop om een bericht achter te laten. Afvinken slaat direct op, met
tijdstempel, en kan ongedaan gemaakt worden.

De gewerkte tijd komt terug in het beheer: als label bij de week, en in de
historie per week met de exacte begin- en eindtijden.

#### De beoogde werktijd

In het beheer staat onder **Takenbibliotheek → ⏱ Werktijd** één getal: hoelang
een schoonmaakbeurt zou moeten duren. Standaard 3 uur. Dat getal doet twee
dingen tegelijk, en dat is met opzet — twee aparte instellingen zouden
onvermijdelijk uit de pas gaan lopen.

**Bij het samenstellen** staat boven de weeklijst een tijdbalk: wat je hebt
ingepland, afgezet tegen die 3 uur, met daaronder de splitsing *"3 uur 30 moet
deze week af · 25 min mag blijven liggen"*. Zit je erboven, dan kleurt hij rood
en staat erbij hoeveel te veel het is — en of dat helemaal in de buffer zit of
ook in wat echt moet. Per ruimte staat het subtotaal in de kop. Zo zie je het
tijdens het aanvinken, in plaats van achteraf op de urenstaat.

> Even voor de maat: de hele bibliotheek is 4 uur 45 aan werk, en alle wekelijkse
> taken plus de opruimtaken samen zijn al 3 uur 55. Een volle lijst past dus niet
> in 3 uur. Dat is geen treuzelen maar rekenen.

**Bij haar** loopt er tijdens het werk een balk mee onder de klok: *"nog 1 uur
tot 3 uur"*. Gaat ze erover, dan worden de klok en de balk rood. Daaronder staat
bij de voortgang hoeveel werk er nog ligt: *"nog 22 taken · ± 3 uur 40"*, dat
meeloopt met het afvinken. Die twee regels onder elkaar zijn het punt — zo ziet
ze om half elf al dat het niet gaat passen, in plaats van pas bij het alarm.

Op elke openstaande taak staat de schatting als een rustig grijs *"± 10 min"*,
naast "mag blijven liggen". Zonder dat kan ze er ook niets over terugkoppelen:
wie nooit ziet dat jij tien minuten voor de douche rekende, kan niet melden dat
het er twintig zijn. Een afgevinkte taak laat het weg; daar valt niets meer aan
te plannen. Het is met opzet dezelfde stille opmaak als in het beheerscherm — een
schatting, geen norm.

#### Het alarm, en als er niet op *klaar* getikt wordt

- **Op de beoogde werktijd** (3 uur) verschijnt een rood blok: *"⏰ De 3 uur is
  om"*, met daaronder wat er nog moet en wat mag blijven liggen — met aantallen
  en geschatte tijd. Alleen "je bent al 3 uur bezig" helpt haar niet; dan staat
  ze halverwege de badkamer en weet ze nog steeds niet wat ze mag overslaan.
  Een knop **Nog even door** zet het weg tot de volgende keer.
- Daarna **elk half uur opnieuw**, tot ze klaar is.
- **Na 4 uur** sluit de app het bezoek zelf af. In de historie staat er dan
  "vanzelf afgesloten" bij, zodat een beheerder het verschil ziet.

De eindtijd wordt niet op het moment van afsluiten geprikt maar berekend uit
`gestartOp + 4 uur`. Elk toestel komt zo op dezelfde tijd uit, en tweemaal
afsluiten verandert niets (de bewerking is idempotent). Het afkappen gebeurt ook
in de weergave: een nog lopend bezoek van meer dan 4 uur telt nooit langer mee
dan 4 uur, ook niet als het toestel offline stond.

Belangrijk om te weten: **het alarm komt alleen in de app**. Zonder server is er
geen push-notificatie — staat de telefoon in haar zak met de app dicht, dan ziet
ze het pas als ze hem weer opent. Het automatisch afsluiten gebeurt wél altijd,
want dat wordt uit de starttijd afgeleid en niet uit een timer.

De drie tijden staan als `herinnerNa`, `herinnerElke` en `stopNa` (in minuten)
in `instellingen`; zonder waarde gelden 180, 30 en 240. `stopNa` wordt nooit
lager dan `herinnerNa` gebruikt — anders zou de app afsluiten op het moment dat
zij het alarm juist nodig heeft.

In de historie staat bij elke week de gewerkte tijd náást de geplande tijd, zodat
je over een paar weken ziet of de schattingen kloppen.

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

Snel achter elkaar tikken mag ook. Bewerkingen die elkaar overschrijven (de
weeklijst samenstellen, een notitie typen) dragen een vervangsleutel: een nieuwe
neemt de plek van de wachtende in, zodat vijf tikken één schrijfactie worden. Wat
er tijdens het schrijven bij komt, blijft in de rij staan en gaat meteen daarna
mee — ook daar is een test voor.

De gegevens staan in drie losse bestanden (bibliotheek, weken, berichten), zodat
een wijziging alleen het bestand raakt waar hij bij hoort.

**Foto's** staan in een eigen Gist, één bestand per foto. Een foto verandert
nooit — een vervangen foto krijgt een nieuw id — dus zodra een toestel ze heeft,
blijven ze in IndexedDB staan en gaat er niets meer over de lijn. De browser
verkleint een foto naar maximaal 1100 pixels voordat er iets verstuurd wordt; een
kiekje van 4 MB wordt zo een bestand van enkele tientallen kilobytes.

## Het huis

Eengezinswoning over drie woonlagen plus dakkamer. Begane grond: open keuken die
doorloopt in de woonkamer, hal en trap. Eerste verdieping: overloop, badkamer
(met het enige toilet), sportkamer, studeerkamer, slaapkamer. Daarboven via een
tweede trap de dakkamer met een klein keukentje.

Overal laminaat, behalve de woonkamer — daar ligt zeil. **Laminaat mag alleen
nevelvochtig gedweild worden**, dus die zin staat letterlijk in de omschrijving
van elke dweiltaak op laminaat. Er is een test die dat bewaakt.

De keuken en de woonkamer zijn één doorlopende ruimte; één vloertaak dekt ze
allebei, met beide vloersoorten in de omschrijving.

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
    bron.js           waar bestanden heen gaan: de Gist, of lokaal (testmodus)
    opslag.js         document, wachtrij, samenvoegen en wegschrijven
    testdata.js       gevulde voorbeeldweken voor de testmodus
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

## Versie en opruimen

Onderaan elk tabblad van het beheer en op de inrichtingspagina staat welke versie
er draait — het commit-nummer plus de publicatiedatum. Dat stempelt de workflow bij het
publiceren in `versie.json`, en tegelijk in de cachenaam van de service worker.

Dat laatste is belangrijk: eerder stond die naam vast, waardoor je browser na een
publicatie de oude app bleef serveren tot je hard verversde. Nu vervalt de oude
cache vanzelf, en verschijnt er onderin een balkje **"Er staat een nieuwe versie
klaar — Vernieuwen"** zodra dat zo is.

De service worker haalt pagina's en code bovendien **eerst van het netwerk** en
pas bij geen bereik uit de cache. Daarvoor was het andersom, waardoor je een
nieuwe versie altijd één herlaadbeurt te laat zag. Plaatjes komen nog wel uit de
cache: die veranderen toch niet. Er is een test die een publicatie nabootst en
controleert dat de wijziging meteen binnenkomt én dat de app offline blijft
openen.

**Historie wissen.** Onderaan het tabblad *Historie* staat een knop om alles weg
te gooien wat je tijdens het uitproberen hebt opgebouwd: weken, afvinkjes,
opmerkingen, werkbeurten en berichten. Het venster somt eerst op wat er precies
verdwijnt. De takenbibliotheek, de ruimtes, de foto's en de schoonmaaksters
blijven staan.

De bewerking bevat een expliciete lijst van wat er weg moet, en niet "alles".
Daardoor wist opnieuw afspelen precies dezelfde weken, en niet wat er intussen
op een ander apparaat bij is gekomen.

## Testen

```bash
npm test           # 109 tests, puur Node
npm run dev        # bekijk de app lokaal op http://localhost:4321
npm run browsertest   # in een echte browser; vereist de dev-server hierboven
```

De Node-tests draaien ook bij elke push; publiceren gebeurt alleen als ze slagen.
De browsertests (`test/browser/`) hebben Playwright nodig en draaien daarom met
de hand; zie `test/browser/LEESMIJ.md`. Ze lopen in de **testmodus**, dus er gaat
niets naar GitHub.

Wat ze afdekken: ISO-weeklogica inclusief jaren met 53 weken; alle bewerkingen op
het datamodel, inclusief starten, klaar melden en de opruimtaken (die er vanzelf
bij staan tot je ze wegklikt); de tijdbegroting en het alarm, met een verzetbare
klok; het gesprek met berichten en opmerkingen door elkaar op volgorde van de
tijd; dat elke laminaatvloer de waarschuwing tegen nat dweilen draagt; en het
synchroniseren tegen een
**nagebouwde Gist-API** (`test/nep-gist.js`) — gelijktijdig werken op telefoon en
laptop, een wachtrij die een herstart overleeft, offline openen, een verkeerde
sleutel, een beschadigd bestand in de Gist, en dat foto's maar één keer worden
opgehaald.

Eén ding is bewust nagebootst en niet echt getest: de verzoeken naar
`api.github.com` zelf. Die zijn in deze omgeving niet bereikbaar. De app rekent
daarom nergens op onbewezen gedrag — als de ETag onverhoopt niet leesbaar is,
werkt alles nog steeds, alleen wordt er wat vaker gedownload. Ook daar is een
test voor.

## Bewust niet gebouwd

Meerdere huishoudens, facturatie, push-notificaties (daar is een server voor
nodig; de herinnering na 3 uur is daarom in-app), foto's als bewijs achteraf, en
het automatisch samenstellen van de weeklijst op basis van frequentie. De
structuur staat het toe: `standaardFrequentie`, de historie per taak en de
geregistreerde tijden liggen er al voor klaar.
