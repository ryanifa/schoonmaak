/* Het datamodel en alle bewerkingen erop.
   Bewust puur: geen netwerk, geen DOM. Een bewerking is een gewoon object dat
   opnieuw afgespeeld kan worden op een nieuwere versie van het document — zo
   gaan wijzigingen van de telefoon en de laptop niet van elkaar verloren. */

import { startdatumVanWeek, alsDatumTekst, wekenTussen, huidigeWeek, vorigeWeek, volgendeWeek } from './week.js';

export const FREQUENTIES = ['wekelijks', 'tweewekelijks', 'maandelijks', 'incidenteel'];

/**
 * Het type bepaalt hoe een taak zich in de app gedraagt:
 *  - wekelijks     staat standaard aan in de weeklijst
 *  - periodiek     de beheerder zet hem aan als hij aan de beurt is
 *  - indien_nodig  staat altijd in de lijst; de schoonmaakster beoordeelt zelf
 */
export const TAAKTYPES = ['wekelijks', 'periodiek', 'indien_nodig'];
export const TAAKTYPE_LABEL = {
  wekelijks: 'wekelijks',
  periodiek: 'periodiek',
  indien_nodig: 'indien nodig',
};

/** Uitkomst van een indien_nodig-taak. */
export const RESULTATEN = ['was_al_gedaan', 'zelf_gedaan'];
export const RESULTAAT_LABEL = {
  was_al_gedaan: 'was al in orde',
  zelf_gedaan: 'heeft zij gedaan',
};

/**
 * Werktijden, in minuten. Er is geen server die kan meekijken, dus alles wordt
 * afgeleid uit de starttijd van het bezoek. Daardoor rekent elk apparaat
 * hetzelfde uit en blijft opnieuw afspelen veilig.
 *
 * `herinnerNa` is één getal met twee rollen: het is de beoogde werktijd waar de
 * weeklijst tegen afgemeten wordt, én het moment waarop het alarm afgaat. Twee
 * aparte instellingen zouden onvermijdelijk uit de pas gaan lopen.
 */
export const WERKTIJD = {
  herinnerNa: 3 * 60,   // beoogde werktijd; hier gaat het alarm af
  herinnerElke: 30,     // en daarna elk half uur opnieuw
  stopNa: 4 * 60,       // hierna sluit de app het bezoek zelf af
};

export function werktijden(doc) {
  const i = doc?.instellingen || {};
  const getal = (waarde, standaard) => (Number(waarde) > 0 ? Number(waarde) : standaard);
  const herinnerNa = getal(i.herinnerNa, WERKTIJD.herinnerNa);
  return {
    herinnerNa,
    budget: herinnerNa,
    herinnerElke: getal(i.herinnerElke, WERKTIJD.herinnerElke),
    // Nooit eerder stoppen dan het alarm: anders sluit de app af op het moment
    // dat zij hem juist nodig heeft.
    stopNa: Math.max(getal(i.stopNa, WERKTIJD.stopNa), herinnerNa),
  };
}

export const DOCUMENT_VERSIE = 1;

export function leegDocument() {
  return {
    versie: DOCUMENT_VERSIE,
    ruimtes: [],
    taken: [],
    weken: {},
    berichten: [],
    schoonmakers: [],
    instellingen: {},
  };
}

/** Sleutel van een week: "2026-34". Sorteert op jaar en weeknummer. */
export function weekSleutel(jaar, weeknummer) {
  return `${jaar}-${String(weeknummer).padStart(2, '0')}`;
}

export function uitWeekSleutel(sleutel) {
  const [jaar, weeknummer] = sleutel.split('-').map(Number);
  return { jaar, weeknummer };
}

/** Redelijk uniek id zonder server. */
export function nieuwId(voorvoegsel) {
  return `${voorvoegsel}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* --------------------------------------------------------------- bewerkingen */

/**
 * Past één bewerking toe op een document. Geeft een nieuw document terug en
 * laat het origineel met rust, zodat opnieuw afspelen veilig is.
 */
export function pasToe(doc, bewerking) {
  const d = {
    versie: doc.versie ?? DOCUMENT_VERSIE,
    // Blijft staan zodat de testmodus weet welke voorbeeldbibliotheek erin zit.
    ...(doc.seedVersie ? { seedVersie: doc.seedVersie } : {}),
    ruimtes: [...(doc.ruimtes || [])],
    taken: [...(doc.taken || [])],
    weken: { ...(doc.weken || {}) },
    berichten: [...(doc.berichten || [])],
    schoonmakers: [...(doc.schoonmakers || [])],
    instellingen: { ...(doc.instellingen || {}) },
  };

  switch (bewerking.soort) {
    case 'ruimte.maak': {
      if (d.ruimtes.some((r) => r.id === bewerking.id)) break;
      const volgorde = d.ruimtes.reduce((max, r) => Math.max(max, r.volgorde), -1) + 1;
      d.ruimtes.push({ id: bewerking.id, naam: bewerking.naam, volgorde, actief: true });
      break;
    }
    case 'ruimte.bewerk': {
      d.ruimtes = d.ruimtes.map((r) => (r.id === bewerking.id ? { ...r, ...bewerking.velden } : r));
      break;
    }
    case 'ruimte.volgorde': {
      const plek = new Map(bewerking.ids.map((id, i) => [id, i]));
      d.ruimtes = d.ruimtes.map((r) => (plek.has(r.id) ? { ...r, volgorde: plek.get(r.id) } : r));
      break;
    }
    case 'taak.maak': {
      if (d.taken.some((t) => t.id === bewerking.taak.id)) break;
      const inRuimte = d.taken.filter((t) => t.ruimteId === bewerking.taak.ruimteId);
      const volgorde = inRuimte.reduce((max, t) => Math.max(max, t.volgorde), -1) + 1;
      d.taken.push({ volgorde, actief: true, ...bewerking.taak });
      break;
    }
    case 'taak.bewerk': {
      d.taken = d.taken.map((t) => (t.id === bewerking.id ? { ...t, ...bewerking.velden } : t));
      break;
    }
    case 'taak.volgorde': {
      const plek = new Map(bewerking.ids.map((id, i) => [id, i]));
      d.taken = d.taken.map((t) => (plek.has(t.id) ? { ...t, volgorde: plek.get(t.id) } : t));
      break;
    }
    case 'week.notitie': {
      const week = zorgVoorWeek(d, bewerking.week);
      d.weken[bewerking.week] = { ...week, notitie: bewerking.notitie };
      break;
    }
    case 'week.taken': {
      const week = zorgVoorWeek(d, bewerking.week);
      const oud = week.taken || {};
      const nieuw = {};
      for (const taakId of new Set(bewerking.taakIds)) {
        // Al afgevinkte taken houden hun stand als ze op de lijst blijven.
        nieuw[taakId] = oud[taakId] || { afgevinkt: false, afgevinktOp: null, opmerking: '' };
      }
      // We onthouden welke taken de beheerder op dat moment vóór zich had. Een
      // opruimtaak die hij toen wegliet blijft weg; eentje die er later bij
      // komt is nog niet beoordeeld en hoort er dus wél vanzelf bij.
      const bekend = [...new Set(bewerking.bekend || bewerking.taakIds)];
      d.weken[bewerking.week] = { ...week, taken: nieuw, samengesteld: bekend };
      break;
    }
    case 'weektaak.afvinken': {
      const week = zorgVoorWeek(d, bewerking.week);
      const bestaand = standVoor(d, week, bewerking.taakId);
      if (!bestaand) break; // taak staat niet (meer) op deze weeklijst
      d.weken[bewerking.week] = {
        ...week,
        taken: {
          ...week.taken,
          [bewerking.taakId]: {
            ...bestaand,
            afgevinkt: bewerking.afgevinkt,
            afgevinktOp: bewerking.afgevinkt ? bewerking.tijd : null,
            resultaat: bewerking.afgevinkt ? (bestaand.resultaat ?? null) : null,
          },
        },
      };
      break;
    }
    case 'weektaak.resultaat': {
      // Voor opruimtaken: wel of niet nodig geweest. Beide gelden als afgerond.
      const week = zorgVoorWeek(d, bewerking.week);
      const bestaand = standVoor(d, week, bewerking.taakId);
      if (!bestaand) break;
      const gekozen = RESULTATEN.includes(bewerking.resultaat) ? bewerking.resultaat : null;
      d.weken[bewerking.week] = {
        ...week,
        taken: {
          ...week.taken,
          [bewerking.taakId]: {
            ...bestaand,
            resultaat: gekozen,
            afgevinkt: gekozen !== null,
            afgevinktOp: gekozen !== null ? bewerking.tijd : null,
          },
        },
      };
      break;
    }
    case 'weektaak.opmerking': {
      const week = zorgVoorWeek(d, bewerking.week);
      const bestaand = standVoor(d, week, bewerking.taakId);
      if (!bestaand) break;
      d.weken[bewerking.week] = {
        ...week,
        taken: { ...week.taken, [bewerking.taakId]: { ...bestaand, opmerking: bewerking.opmerking } },
      };
      break;
    }
    case 'schoonmaker.maak': {
      if (d.schoonmakers.some((s) => s.id === bewerking.id)) break;
      const volgorde = d.schoonmakers.reduce((max, s) => Math.max(max, s.volgorde), -1) + 1;
      d.schoonmakers.push({ id: bewerking.id, naam: bewerking.naam, volgorde, actief: true });
      // De eerste die je toevoegt is meteen de standaard.
      if (!d.instellingen.standaardSchoonmaker) d.instellingen.standaardSchoonmaker = bewerking.id;
      break;
    }
    case 'schoonmaker.bewerk': {
      d.schoonmakers = d.schoonmakers.map((s) => (s.id === bewerking.id ? { ...s, ...bewerking.velden } : s));
      // Een gearchiveerde schoonmaakster kan geen standaard blijven.
      if (bewerking.velden?.actief === false && d.instellingen.standaardSchoonmaker === bewerking.id) {
        const volgende = d.schoonmakers.find((s) => s.actief);
        d.instellingen = { ...d.instellingen, standaardSchoonmaker: volgende ? volgende.id : null };
      }
      break;
    }
    case 'schoonmaker.volgorde': {
      const plek = new Map(bewerking.ids.map((id, i) => [id, i]));
      d.schoonmakers = d.schoonmakers.map((s) => (plek.has(s.id) ? { ...s, volgorde: plek.get(s.id) } : s));
      break;
    }
    case 'instelling.zet': {
      d.instellingen = { ...d.instellingen, [bewerking.sleutel]: bewerking.waarde };
      break;
    }
    case 'bezoek.start': {
      const week = zorgVoorWeek(d, bewerking.week);
      const bezoeken = week.bezoeken || [];
      // Idempotent: hetzelfde bezoek nog eens starten verandert niets.
      const nieuw = bezoeken.some((b) => b.id === bewerking.id)
        ? bezoeken.map((b) => (b.id === bewerking.id
          ? { ...b, gestartOp: bewerking.tijd, schoonmakerId: bewerking.schoonmakerId ?? b.schoonmakerId ?? null }
          : b))
        : [...bezoeken, {
          id: bewerking.id,
          gestartOp: bewerking.tijd,
          gestoptOp: null,
          schoonmakerId: bewerking.schoonmakerId ?? null,
        }];
      d.weken[bewerking.week] = { ...week, bezoeken: nieuw };
      break;
    }
    case 'bezoek.stop': {
      const week = zorgVoorWeek(d, bewerking.week);
      const bezoeken = week.bezoeken || [];
      if (!bezoeken.some((b) => b.id === bewerking.id)) break;
      d.weken[bewerking.week] = {
        ...week,
        bezoeken: bezoeken.map((b) => (b.id === bewerking.id
          ? { ...b, gestoptOp: bewerking.tijd, automatisch: !!bewerking.automatisch }
          : b)),
      };
      break;
    }
    case 'historie.wis': {
      // Bewust een expliciete lijst en geen "alles": opnieuw afspelen wist dan
      // precies dezelfde weken, en niet wat er inmiddels bij is gekomen.
      const wegWeken = new Set(bewerking.weken || []);
      const wegBerichten = new Set(bewerking.berichten || []);
      d.weken = Object.fromEntries(Object.entries(d.weken).filter(([sleutel]) => !wegWeken.has(sleutel)));
      d.berichten = d.berichten.filter((b) => !wegBerichten.has(b.id));
      break;
    }
    case 'bericht.maak': {
      if (d.berichten.some((b) => b.id === bewerking.bericht.id)) break;
      d.berichten = [bewerking.bericht, ...d.berichten].slice(0, 500);
      break;
    }
    case 'bericht.gelezen': {
      d.berichten = d.berichten.map((b) => (b.id === bewerking.id ? { ...b, gelezen: bewerking.gelezen } : b));
      break;
    }
    case 'berichten.allesGelezen': {
      d.berichten = d.berichten.map((b) => (b.afzender === bewerking.afzender ? { ...b, gelezen: true } : b));
      break;
    }
    default:
      console.warn('Onbekende bewerking overgeslagen:', bewerking.soort);
  }
  return d;
}

/** Speelt een reeks bewerkingen af op een document. */
export function speelAf(doc, bewerkingen) {
  return bewerkingen.reduce((tussenstand, b) => pasToe(tussenstand, b), doc);
}

/**
 * De stand van één taak in een week. Voor taken die er vanzelf bij horen maken
 * we hem zo nodig alsnog aan — die kunnen ook zonder de beheerder afgerond
 * worden, en een nieuw toegevoegde opruimtaak moet meteen bruikbaar zijn.
 */
function standVoor(d, week, taakId) {
  const bestaand = week.taken?.[taakId];
  if (bestaand) return bestaand;
  if (!vanzelfOpDeLijst(d, week).includes(taakId)) return null;
  return { afgevinkt: false, afgevinktOp: null, opmerking: '', resultaat: null };
}

function zorgVoorWeek(d, sleutel) {
  const bestaand = d.weken[sleutel];
  if (bestaand) return bestaand;
  const { jaar, weeknummer } = uitWeekSleutel(sleutel);
  return {
    jaar, weeknummer,
    startdatum: alsDatumTekst(startdatumVanWeek(jaar, weeknummer)),
    notitie: '',
    taken: {},
    bezoeken: [],
  };
}

/** Welke bestanden raakt deze bewerking? Bepaalt wat er weggeschreven wordt. */
export function geraakteDelen(bewerking) {
  // Historie wissen raakt zowel de weken als de berichten.
  if (bewerking.soort === 'historie.wis') return ['weken', 'berichten'];
  if (bewerking.soort.startsWith('ruimte.')
    || bewerking.soort.startsWith('taak.')
    || bewerking.soort.startsWith('schoonmaker.')
    || bewerking.soort.startsWith('instelling.')) return ['bibliotheek'];
  if (bewerking.soort.startsWith('week')
    || bewerking.soort.startsWith('weektaak.')
    || bewerking.soort.startsWith('bezoek.')) return ['weken'];
  return ['berichten'];
}

/* ------------------------------------------------------------------ afleiden */

/**
 * Vult ontbrekende velden aan. Taken uit een oudere versie hebben nog geen
 * `type`; dat leiden we af uit de frequentie, zodat niets omvalt.
 */
function metType(taak) {
  if (TAAKTYPES.includes(taak.type)) return taak;
  return { ...taak, type: taak.standaardFrequentie === 'wekelijks' ? 'wekelijks' : 'periodiek' };
}

/** Opruimtaken: die staan standaard op de weeklijst. */
export function altijdOpDeLijst(doc) {
  return (doc.taken || []).map(metType).filter((t) => t.actief && t.type === 'indien_nodig');
}

/**
 * Welke opruimtaken er in déze week vanzelf bij horen: die de beheerder nog
 * niet beoordeeld heeft. Heeft hij de week nooit samengesteld, dan zijn dat ze
 * allemaal. Heeft hij dat wel gedaan, dan alleen de taken die er daarna bij
 * gekomen zijn — een taak die hij toen bewust wegliet, blijft weg.
 */
export function vanzelfOpDeLijst(doc, week) {
  const beoordeeld = new Set(week?.samengesteld || []);
  return altijdOpDeLijst(doc).map((t) => t.id).filter((id) => !beoordeeld.has(id));
}

export function ruimteLijst(doc, { inclusiefGearchiveerd = false } = {}) {
  return (doc.ruimtes || [])
    .filter((r) => inclusiefGearchiveerd || r.actief)
    .sort((a, b) => a.volgorde - b.volgorde);
}

export function taakLijst(doc, { inclusiefGearchiveerd = false } = {}) {
  const ruimtePlek = new Map(ruimteLijst(doc, { inclusiefGearchiveerd: true }).map((r, i) => [r.id, i]));
  const ruimteNaam = new Map((doc.ruimtes || []).map((r) => [r.id, r.naam]));
  return (doc.taken || [])
    .map(metType)
    .filter((t) => inclusiefGearchiveerd || t.actief)
    .map((t) => ({ ...t, ruimteNaam: ruimteNaam.get(t.ruimteId) || 'Zonder ruimte' }))
    .sort((a, b) => (ruimtePlek.get(a.ruimteId) ?? 999) - (ruimtePlek.get(b.ruimteId) ?? 999)
      || a.volgorde - b.volgorde);
}

export function haalWeek(doc, jaar, weeknummer) {
  const sleutel = weekSleutel(jaar, weeknummer);
  const week = doc.weken?.[sleutel];
  return {
    sleutel,
    jaar,
    weeknummer,
    startdatum: week?.startdatum || alsDatumTekst(startdatumVanWeek(jaar, weeknummer)),
    notitie: week?.notitie || '',
    taken: week?.taken || {},
    bezoeken: week?.bezoeken || [],
    // Welke taken de beheerder al beoordeeld heeft; leeg = nog nooit aangeraakt.
    samengesteld: week?.samengesteld || null,
  };
}

/* ------------------------------------------------------------- schoonmakers */

export function schoonmakerLijst(doc, { inclusiefGearchiveerd = false } = {}) {
  return (doc.schoonmakers || [])
    .filter((s) => inclusiefGearchiveerd || s.actief)
    .sort((a, b) => a.volgorde - b.volgorde);
}

/** Wie er standaard voorgesteld wordt als er meerdere zijn. */
export function standaardSchoonmaker(doc) {
  const actief = schoonmakerLijst(doc);
  if (!actief.length) return null;
  const gekozen = actief.find((s) => s.id === doc.instellingen?.standaardSchoonmaker);
  return gekozen || actief[0];
}

export function schoonmakerNaam(doc, id) {
  if (!id) return null;
  return (doc.schoonmakers || []).find((s) => s.id === id)?.naam || null;
}

/* ------------------------------------------------------------------ bezoeken */

/** Het bezoek dat nu bezig is: wel gestart, nog niet afgerond. */
export function lopendBezoek(week) {
  return (week.bezoeken || []).find((b) => b.gestartOp && !b.gestoptOp) || null;
}

/**
 * Gewerkte minuten in een week. Een bezoek dat nog loopt telt mee tot `nu`,
 * maar nooit langer dan `stopNa`: na die tijd sluit de app het bezoek zelf af.
 */
export function gewerkteMinuten(week, nu = new Date(), stopNa = WERKTIJD.stopNa) {
  let totaal = 0;
  for (const bezoek of week.bezoeken || []) {
    const minuten = bezoekMinuten(bezoek, nu, stopNa);
    if (minuten) totaal += minuten;
  }
  return Math.round(totaal);
}

/** Hoelang één bezoek duurde (of tot nu toe duurt), begrensd op `stopNa`. */
export function bezoekMinuten(bezoek, nu = new Date(), stopNa = WERKTIJD.stopNa) {
  if (!bezoek?.gestartOp) return 0;
  const start = new Date(bezoek.gestartOp);
  if (Number.isNaN(start.getTime())) return 0;
  const eind = bezoek.gestoptOp ? new Date(bezoek.gestoptOp) : nu;
  if (Number.isNaN(eind.getTime()) || eind <= start) return 0;
  return Math.min((eind - start) / 60000, stopNa);
}

/** Bezoeken die de app zelf heeft afgesloten omdat er niet op "klaar" is getikt. */
export function automatischGestopteBezoeken(week) {
  return (week.bezoeken || []).filter((b) => b.automatisch);
}

/**
 * Loopt er een bezoek al langer dan `stopNa`? Dan levert dit de bewerking op om
 * het af te sluiten. De eindtijd komt uit de starttijd en niet uit `nu`, zodat
 * elk apparaat op dezelfde uitkomst komt.
 */
export function autoStopBewerkingen(doc, nu = new Date()) {
  const { stopNa } = werktijden(doc);
  const bewerkingen = [];
  for (const [sleutel, week] of Object.entries(doc.weken || {})) {
    for (const bezoek of week.bezoeken || []) {
      if (!bezoek.gestartOp || bezoek.gestoptOp) continue;
      const start = new Date(bezoek.gestartOp);
      if (Number.isNaN(start.getTime())) continue;
      const grens = new Date(start.getTime() + stopNa * 60000);
      if (nu < grens) continue;
      bewerkingen.push({
        soort: 'bezoek.stop',
        week: sleutel,
        id: bezoek.id,
        tijd: grens.toISOString(),
        automatisch: true,
      });
    }
  }
  return bewerkingen;
}

/**
 * De hoeveelste herinnering is er nu aan de beurt? Eerst na `herinnerNa`, daarna
 * elke `herinnerElke` minuten. `null` als er nog niets te melden valt.
 */
export function herinneringNummer(bezoek, nu = new Date(), tijden = WERKTIJD) {
  if (!bezoek?.gestartOp || bezoek.gestoptOp) return null;
  const minuten = (nu - new Date(bezoek.gestartOp)) / 60000;
  if (!(minuten >= tijden.herinnerNa)) return null;
  return Math.floor((minuten - tijden.herinnerNa) / tijden.herinnerElke) + 1;
}

/** "1 uur 45" / "35 min" */
export function alsDuur(minuten) {
  if (!minuten) return '0 min';
  const uren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  if (!uren) return `${rest} min`;
  if (!rest) return uren === 1 ? '1 uur' : `${uren} uur`;
  return `${uren} uur ${String(rest).padStart(2, '0')}`;
}

/** De weeklijst zoals de schoonmaakster hem ziet: per ruimte, in volgorde. */
export function weekOverzicht(doc, jaar, weeknummer) {
  const week = haalWeek(doc, jaar, weeknummer);
  const perTaak = new Map(taakLijst(doc, { inclusiefGearchiveerd: true }).map((t) => [t.id, t]));
  const altijd = new Set(vanzelfOpDeLijst(doc, week));
  const regels = [];
  for (const taak of taakLijst(doc, { inclusiefGearchiveerd: true })) {
    const stand = week.taken[taak.id];
    // Een opruimtaak hoort er ook bij als de beheerder hem nooit heeft aangezet.
    if (!stand && !altijd.has(taak.id)) continue;
    regels.push({
      taakId: taak.id,
      titel: taak.titel,
      omschrijving: taak.omschrijving,
      type: taak.type,
      fotoId: taak.fotoId || null,
      geschatteMinuten: taak.geschatteMinuten,
      magWachten: !!taak.magWachten,
      ruimteId: taak.ruimteId,
      ruimteNaam: taak.ruimteNaam,
      afgevinkt: !!stand?.afgevinkt,
      afgevinktOp: stand?.afgevinktOp || null,
      opmerking: stand?.opmerking || '',
      resultaat: stand?.resultaat || null,
    });
  }
  // Taken die intussen uit de bibliotheek verdwenen zijn, laten we netjes vallen.
  const gedaan = regels.filter((r) => r.afgevinkt).length;
  return {
    week,
    groepen: groepeerPerRuimte(regels),
    regels,
    voortgang: { gedaan, totaal: regels.length },
    berichten: (doc.berichten || []).filter((b) => b.week === week.sleutel),
    bezoeken: week.bezoeken,
    onbekend: perTaak.size === 0,
  };
}

/**
 * Wat een lijst taken bij elkaar aan tijd kost, afgezet tegen de beoogde
 * werktijd. `moet` telt alleen de taken die deze week echt af moeten; dat is
 * het getal dat moet passen. Wat mag blijven liggen is de buffer.
 */
export function tijdBegroting(taken, budget) {
  const minuten = (lijst) => lijst.reduce((som, t) => som + (t.geschatteMinuten || 0), 0);
  const moet = taken.filter((t) => !t.magWachten);
  const wacht = taken.filter((t) => t.magWachten);
  return {
    budget,
    moetMinuten: minuten(moet),
    wachtMinuten: minuten(wacht),
    totaalMinuten: minuten(taken),
    aantalMoet: moet.length,
    aantalWacht: wacht.length,
    // Positief betekent: hier past het niet meer binnen de beoogde werktijd.
    over: minuten(taken) - budget,
    moetOver: minuten(moet) - budget,
  };
}

/** Wat er nog te doen is, gesplitst in wat moet en wat kan blijven liggen. */
export function watStaatNogOpen(overzicht) {
  const open = (overzicht.regels || []).filter((r) => !r.afgevinkt);
  return {
    moet: open.filter((r) => !r.magWachten),
    magWachten: open.filter((r) => r.magWachten),
  };
}

export function groepeerPerRuimte(regels) {
  const groepen = [];
  const index = new Map();
  for (const regel of regels) {
    if (!index.has(regel.ruimteId)) {
      const groep = { ruimteId: regel.ruimteId, ruimteNaam: regel.ruimteNaam, taken: [] };
      index.set(regel.ruimteId, groep);
      groepen.push(groep);
    }
    index.get(regel.ruimteId).taken.push(regel);
  }
  return groepen;
}

/** Per taak: hoeveel weken geleden voor het laatst afgevinkt, gezien vanaf `startdatum`. */
export function laatstGedaan(doc, startdatum) {
  const kaart = new Map();
  for (const week of Object.values(doc.weken || {})) {
    if (!week.startdatum || week.startdatum > startdatum) continue;
    for (const [taakId, stand] of Object.entries(week.taken || {})) {
      if (!stand.afgevinkt) continue;
      const huidig = kaart.get(taakId);
      if (!huidig || week.startdatum > huidig) kaart.set(taakId, week.startdatum);
    }
  }
  const resultaat = new Map();
  for (const [taakId, laatste] of kaart) {
    resultaat.set(taakId, { laatsteStartdatum: laatste, wekenGeleden: wekenTussen(laatste, startdatum) });
  }
  return resultaat;
}

/** Alles wat de beheerder nodig heeft om een week samen te stellen. */
export function weekSamensteller(doc, jaar, weeknummer) {
  const week = haalWeek(doc, jaar, weeknummer);
  const laatst = laatstGedaan(doc, week.startdatum);
  const vanzelf = new Set(vanzelfOpDeLijst(doc, week));
  const alle = taakLijst(doc).map((taak) => {
    const info = laatst.get(taak.id);
    return {
      ...taak,
      geselecteerd: Object.hasOwn(week.taken, taak.id) || vanzelf.has(taak.id),
      afgevinkt: !!week.taken[taak.id]?.afgevinkt,
      wekenGeleden: info ? info.wekenGeleden : null,
      laatsteStartdatum: info ? info.laatsteStartdatum : null,
    };
  });
  const nu = huidigeWeek();
  const gekozen = alle.filter((t) => t.geselecteerd);
  return {
    week,
    groepen: groepeerPerRuimte(alle),
    aantalGeselecteerd: gekozen.length,
    begroting: tijdBegroting(gekozen, werktijden(doc).budget),
    navigatie: {
      vorige: vorigeWeek(jaar, weeknummer),
      volgende: volgendeWeek(jaar, weeknummer),
      huidige: { jaar: nu.jaar, weeknummer: nu.weeknummer },
    },
  };
}

/** Weekoverzicht voor de historie, nieuwste eerst. */
export function historie(doc, limiet = 12) {
  return Object.entries(doc.weken || {})
    .map(([sleutel, week]) => {
      const standen = Object.values(week.taken || {});
      // Opruimtaken die er vanzelf bij horen staan niet in `taken`, maar zij
      // ziet ze wel. Anders klopt "4 van de 9" in het beheer niet met haar lijst.
      const erbij = vanzelfOpDeLijst(doc, week).filter((id) => !week.taken?.[id]).length;
      return {
        sleutel,
        jaar: week.jaar,
        weeknummer: week.weeknummer,
        startdatum: week.startdatum,
        notitie: week.notitie || '',
        gepland: standen.length + erbij,
        geplandeMinuten: tijdBegroting(weekOverzicht(doc, week.jaar, week.weeknummer).regels,
          werktijden(doc).budget).totaalMinuten,
        afgevinkt: standen.filter((s) => s.afgevinkt).length,
        bezoeken: week.bezoeken || [],
        gewerkteMinuten: gewerkteMinuten(week, new Date(), werktijden(doc).stopNa),
      };
    })
    .filter((w) => w.gepland > 0 || w.notitie || w.bezoeken.length)
    .sort((a, b) => b.startdatum.localeCompare(a.startdatum))
    .slice(0, limiet);
}

/** Wanneer is één taak de afgelopen tijd gedaan? */
export function taakHistorie(doc, taakId, limiet = 26) {
  return Object.values(doc.weken || {})
    .map((week) => ({ week, stand: standVoor(doc, week, taakId) }))
    .filter(({ stand }) => stand)
    .map(({ week, stand }) => ({
      jaar: week.jaar,
      weeknummer: week.weeknummer,
      startdatum: week.startdatum,
      afgevinkt: !!stand.afgevinkt,
      afgevinktOp: stand.afgevinktOp || null,
      opmerking: stand.opmerking || '',
      resultaat: stand.resultaat || null,
    }))
    .sort((a, b) => b.startdatum.localeCompare(a.startdatum))
    .slice(0, limiet);
}

/** Alle opmerkingen die bij taken zijn achtergelaten, nieuwste eerst. */
export function alleOpmerkingen(doc, limiet = 100) {
  const titels = new Map(taakLijst(doc, { inclusiefGearchiveerd: true }).map((t) => [t.id, t]));
  const uit = [];
  for (const week of Object.values(doc.weken || {})) {
    for (const [taakId, stand] of Object.entries(week.taken || {})) {
      if (!stand.opmerking?.trim()) continue;
      const taak = titels.get(taakId);
      uit.push({
        taakId,
        titel: taak?.titel || 'Verwijderde taak',
        ruimteNaam: taak?.ruimteNaam || '',
        jaar: week.jaar,
        weeknummer: week.weeknummer,
        startdatum: week.startdatum,
        afgevinkt: !!stand.afgevinkt,
        opmerking: stand.opmerking,
      });
    }
  }
  return uit.sort((a, b) => b.startdatum.localeCompare(a.startdatum)).slice(0, limiet);
}

/**
 * Hoe vaak een opruimtaak nodig was. Laat de beheerder zien of iets structureel
 * blijft liggen, of juist bijna altijd al in orde is.
 */
export function resultaatTelling(doc, taakId) {
  const telling = { was_al_gedaan: 0, zelf_gedaan: 0, open: 0, weken: 0 };
  for (const week of Object.values(doc.weken || {})) {
    // Ook meetellen als de taak er vanzelf bij hoorde: onbeantwoord is ook een
    // uitkomst, en anders lijkt een nooit-aangeraakte week nooit gepland.
    const stand = standVoor(doc, week, taakId);
    if (!stand) continue;
    telling.weken += 1;
    if (stand.resultaat && Object.hasOwn(telling, stand.resultaat)) telling[stand.resultaat] += 1;
    else if (!stand.afgevinkt) telling.open += 1;
  }
  return telling;
}

/** Wat er verdwijnt als je de historie wist. */
export function historieOmvang(doc) {
  const weken = Object.keys(doc.weken || {});
  const standen = weken.flatMap((s) => Object.values(doc.weken[s].taken || {}));
  const bezoeken = weken.flatMap((s) => doc.weken[s].bezoeken || []);
  return {
    weken,
    berichten: (doc.berichten || []).map((b) => b.id),
    aantalWeken: weken.length,
    aantalAfgevinkt: standen.filter((t) => t.afgevinkt).length,
    aantalOpmerkingen: standen.filter((t) => t.opmerking?.trim()).length,
    aantalBezoeken: bezoeken.length,
    aantalBerichten: (doc.berichten || []).length,
  };
}

export function aantalOngelezen(doc, voorRol) {
  const andere = voorRol === 'beheerder' ? 'schoonmaakster' : 'beheerder';
  return (doc.berichten || []).filter((b) => !b.gelezen && b.afzender === andere).length;
}

/** Taken van de vorige week, om over te nemen. */
export function takenVanVorigeWeek(doc, jaar, weeknummer) {
  const vorige = vorigeWeek(jaar, weeknummer);
  const week = doc.weken?.[weekSleutel(vorige.jaar, vorige.weeknummer)];
  if (!week) return [];
  const actief = new Set(taakLijst(doc).map((t) => t.id));
  return Object.keys(week.taken || {}).filter((id) => actief.has(id));
}
