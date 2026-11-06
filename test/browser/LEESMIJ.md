# Browsertests

Deze draaien in een echte browser en staan daarom los van `npm test` (dat is
puur Node, zonder browser). Ze starten zelf geen server:

```sh
npm run dev &            # serveert app/ op poort 4321
npm run browsertest      # draait alles in deze map
```

Ze gebruiken de **testmodus** van de app (`#c=eyJ4IjoxLCJyIjoi…`), dus er gaat
niets naar GitHub: de gegevens staan in localStorage van de browser.

Een test die de klok vooruit moet zetten doet dat met één init-script dat de
verschuiving uit `localStorage['testklok']` leest. Let op: `addInitScript`
stapelt op — twee keer aanroepen verzet de klok dubbel.
