/* Het datamodel en alle bewerkingen erop.
   Bewust puur: geen netwerk, geen DOM. Een bewerking is een gewoon object dat
   opnieuw afgespeeld kan worden op een nieuwere versie van het document — zo
   gaan wijzigingen van de telefoon en de laptop niet van elkaar verloren. */

import { startdatumVanWeek, alsDatumTekst, wekenTussen, huidigeWeek, vorigeWeek, volgendeWeek } from './week.js';

export const FREQUENTIES = ['wekelijks', 'tweewekelijks', 'maandelijks', 'incidenteel'];
export const DOCUMENT_VERSIE = 1;

export function leegDocument() {
  return { versie: DOCUMENT_VERSIE, ruimtes: [], taken: [], weken: {}, berichten: [] };
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
    ruimtes: [...(doc.ruimtes || [])],
    taken: [...(doc.taken || [])],
    weken: { ...(doc.weken || {}) },
    berichten: [...(doc.berichten || [])],
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
      for (const taakId of bewerking.taakIds) {
        // Al afgevinkte taken houden hun stand als ze op de lijst blijven.
        nieuw[taakId] = oud[taakId] || { afgevinkt: false, afgevinktOp: null, opmerking: '' };
      }
      d.weken[bewerking.week] = { ...week, taken: nieuw };
      break;
    }
    case 'weektaak.afvinken': {
      const week = zorgVoorWeek(d, bewerking.week);
      const bestaand = week.taken?.[bewerking.taakId];
      if (!bestaand) break; // taak staat niet (meer) op deze weeklijst
      d.weken[bewerking.week] = {
        ...week,
        taken: {
          ...week.taken,
          [bewerking.taakId]: {
            ...bestaand,
            afgevinkt: bewerking.afgevinkt,
            afgevinktOp: bewerking.afgevinkt ? bewerking.tijd : null,
          },
        },
      };
      break;
    }
    case 'weektaak.opmerking': {
      const week = zorgVoorWeek(d, bewerking.week);
      const bestaand = week.taken?.[bewerking.taakId];
      if (!bestaand) break;
      d.weken[bewerking.week] = {
        ...week,
        taken: { ...week.taken, [bewerking.taakId]: { ...bestaand, opmerking: bewerking.opmerking } },
      };
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

function zorgVoorWeek(d, sleutel) {
  const bestaand = d.weken[sleutel];
  if (bestaand) return bestaand;
  const { jaar, weeknummer } = uitWeekSleutel(sleutel);
  return {
    jaar, weeknummer,
    startdatum: alsDatumTekst(startdatumVanWeek(jaar, weeknummer)),
    notitie: '',
    taken: {},
  };
}

/** Welke bestanden raakt deze bewerking? Bepaalt wat er weggeschreven wordt. */
export function geraakteDelen(bewerking) {
  if (bewerking.soort.startsWith('ruimte.') || bewerking.soort.startsWith('taak.')) return ['bibliotheek'];
  if (bewerking.soort.startsWith('week') || bewerking.soort.startsWith('weektaak.')) return ['weken'];
  return ['berichten'];
}

/* ------------------------------------------------------------------ afleiden */

export function ruimteLijst(doc, { inclusiefGearchiveerd = false } = {}) {
  return (doc.ruimtes || [])
    .filter((r) => inclusiefGearchiveerd || r.actief)
    .sort((a, b) => a.volgorde - b.volgorde);
}

export function taakLijst(doc, { inclusiefGearchiveerd = false } = {}) {
  const ruimtePlek = new Map(ruimteLijst(doc, { inclusiefGearchiveerd: true }).map((r, i) => [r.id, i]));
  const ruimteNaam = new Map((doc.ruimtes || []).map((r) => [r.id, r.naam]));
  return (doc.taken || [])
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
  };
}

/** De weeklijst zoals de schoonmaakster hem ziet: per ruimte, in volgorde. */
export function weekOverzicht(doc, jaar, weeknummer) {
  const week = haalWeek(doc, jaar, weeknummer);
  const perTaak = new Map(taakLijst(doc, { inclusiefGearchiveerd: true }).map((t) => [t.id, t]));
  const regels = [];
  for (const taak of taakLijst(doc, { inclusiefGearchiveerd: true })) {
    const stand = week.taken[taak.id];
    if (!stand) continue;
    regels.push({
      taakId: taak.id,
      titel: taak.titel,
      omschrijving: taak.omschrijving,
      fotoId: taak.fotoId || null,
      geschatteMinuten: taak.geschatteMinuten,
      ruimteId: taak.ruimteId,
      ruimteNaam: taak.ruimteNaam,
      afgevinkt: !!stand.afgevinkt,
      afgevinktOp: stand.afgevinktOp || null,
      opmerking: stand.opmerking || '',
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
    onbekend: perTaak.size === 0,
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
  const alle = taakLijst(doc).map((taak) => {
    const info = laatst.get(taak.id);
    return {
      ...taak,
      geselecteerd: Object.hasOwn(week.taken, taak.id),
      afgevinkt: !!week.taken[taak.id]?.afgevinkt,
      wekenGeleden: info ? info.wekenGeleden : null,
      laatsteStartdatum: info ? info.laatsteStartdatum : null,
    };
  });
  const nu = huidigeWeek();
  return {
    week,
    groepen: groepeerPerRuimte(alle),
    aantalGeselecteerd: alle.filter((t) => t.geselecteerd).length,
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
      return {
        sleutel,
        jaar: week.jaar,
        weeknummer: week.weeknummer,
        startdatum: week.startdatum,
        notitie: week.notitie || '',
        gepland: standen.length,
        afgevinkt: standen.filter((s) => s.afgevinkt).length,
      };
    })
    .filter((w) => w.gepland > 0 || w.notitie)
    .sort((a, b) => b.startdatum.localeCompare(a.startdatum))
    .slice(0, limiet);
}

/** Wanneer is één taak de afgelopen tijd gedaan? */
export function taakHistorie(doc, taakId, limiet = 26) {
  return Object.values(doc.weken || {})
    .filter((week) => week.taken && Object.hasOwn(week.taken, taakId))
    .map((week) => ({
      jaar: week.jaar,
      weeknummer: week.weeknummer,
      startdatum: week.startdatum,
      afgevinkt: !!week.taken[taakId].afgevinkt,
      afgevinktOp: week.taken[taakId].afgevinktOp || null,
      opmerking: week.taken[taakId].opmerking || '',
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
