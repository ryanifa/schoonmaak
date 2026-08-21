// Datalaag. Kent geen HTTP en geen UI — alleen het datamodel.
import { db, nu, inTransactie } from './db.js';
import {
  huidigeWeek, startdatumVanWeek, alsDatumTekst, vorigeWeek, volgendeWeek,
  wekenTussen, uitDatumTekst, isoWeek,
} from './util/week.js';

export const FREQUENTIES = ['wekelijks', 'tweewekelijks', 'maandelijks', 'incidenteel'];

/* ------------------------------------------------------------------ ruimtes */

export const ruimtes = {
  lijst({ inclusiefGearchiveerd = false } = {}) {
    const waar = inclusiefGearchiveerd ? '' : 'WHERE actief = 1';
    return db.prepare(`
      SELECT id, naam, volgorde, actief FROM ruimtes ${waar} ORDER BY volgorde, id
    `).all().map(normaliseerRuimte);
  },

  maak({ naam }) {
    const volgende = db.prepare('SELECT COALESCE(MAX(volgorde), -1) + 1 AS v FROM ruimtes').get().v;
    const id = db.prepare('INSERT INTO ruimtes (naam, volgorde, actief) VALUES (?, ?, 1)')
      .run(naam.trim(), volgende).lastInsertRowid;
    return this.haal(id);
  },

  haal(id) {
    const r = db.prepare('SELECT id, naam, volgorde, actief FROM ruimtes WHERE id = ?').get(id);
    return r ? normaliseerRuimte(r) : null;
  },

  bewerk(id, { naam, actief }) {
    const huidig = this.haal(id);
    if (!huidig) return null;
    db.prepare('UPDATE ruimtes SET naam = ?, actief = ? WHERE id = ?').run(
      naam === undefined ? huidig.naam : String(naam).trim(),
      actief === undefined ? (huidig.actief ? 1 : 0) : (actief ? 1 : 0),
      id,
    );
    return this.haal(id);
  },

  herorden(ids) {
    inTransactie(() => {
      const stmt = db.prepare('UPDATE ruimtes SET volgorde = ? WHERE id = ?');
      ids.forEach((id, i) => stmt.run(i, id));
    });
    return this.lijst({ inclusiefGearchiveerd: true });
  },
};

function normaliseerRuimte(r) {
  return { id: r.id, naam: r.naam, volgorde: r.volgorde, actief: !!r.actief };
}

/* -------------------------------------------------------------------- taken */

const TAAK_SELECT = `
  SELECT t.id, t.titel, t.ruimte_id AS ruimteId, r.naam AS ruimteNaam, t.omschrijving,
         t.foto_id AS fotoId, t.standaard_frequentie AS standaardFrequentie,
         t.geschatte_minuten AS geschatteMinuten, t.volgorde, t.actief,
         r.volgorde AS ruimteVolgorde
  FROM taken t
  JOIN ruimtes r ON r.id = t.ruimte_id
`;

export const taken = {
  lijst({ inclusiefGearchiveerd = false } = {}) {
    const waar = inclusiefGearchiveerd ? '' : 'WHERE t.actief = 1';
    return db.prepare(`${TAAK_SELECT} ${waar} ORDER BY r.volgorde, r.id, t.volgorde, t.id`)
      .all().map(normaliseerTaak);
  },

  haal(id) {
    const t = db.prepare(`${TAAK_SELECT} WHERE t.id = ?`).get(id);
    return t ? normaliseerTaak(t) : null;
  },

  maak({ titel, ruimteId, omschrijving = '', fotoId = null, standaardFrequentie = 'wekelijks', geschatteMinuten = null }) {
    const volgende = db.prepare('SELECT COALESCE(MAX(volgorde), -1) + 1 AS v FROM taken WHERE ruimte_id = ?')
      .get(ruimteId).v;
    const id = db.prepare(`
      INSERT INTO taken (titel, ruimte_id, omschrijving, foto_id, standaard_frequentie, geschatte_minuten, volgorde, actief, aangemaakt_op)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      titel.trim(), ruimteId, omschrijving ?? '', fotoId,
      FREQUENTIES.includes(standaardFrequentie) ? standaardFrequentie : 'wekelijks',
      geschatteMinuten === null || geschatteMinuten === '' ? null : Number(geschatteMinuten),
      volgende, nu(),
    ).lastInsertRowid;
    return this.haal(id);
  },

  bewerk(id, velden) {
    const huidig = this.haal(id);
    if (!huidig) return null;
    const nieuw = { ...huidig, ...velden };
    db.prepare(`
      UPDATE taken SET titel = ?, ruimte_id = ?, omschrijving = ?, foto_id = ?,
                       standaard_frequentie = ?, geschatte_minuten = ?, actief = ?
      WHERE id = ?
    `).run(
      String(nieuw.titel).trim(), nieuw.ruimteId, nieuw.omschrijving ?? '',
      nieuw.fotoId ?? null,
      FREQUENTIES.includes(nieuw.standaardFrequentie) ? nieuw.standaardFrequentie : 'wekelijks',
      nieuw.geschatteMinuten === null || nieuw.geschatteMinuten === '' ? null : Number(nieuw.geschatteMinuten),
      nieuw.actief ? 1 : 0, id,
    );
    return this.haal(id);
  },

  herorden(ids) {
    inTransactie(() => {
      const stmt = db.prepare('UPDATE taken SET volgorde = ? WHERE id = ?');
      ids.forEach((id, i) => stmt.run(i, id));
    });
    return true;
  },

  /** Per taak: hoeveel weken geleden voor het laatst afgevinkt (t.o.v. `startdatum`). */
  laatstGedaan(startdatum) {
    const rijen = db.prepare(`
      SELECT wt.taak_id AS taakId, MAX(w.startdatum) AS laatsteStart
      FROM weektaken wt
      JOIN weken w ON w.id = wt.week_id
      WHERE wt.afgevinkt = 1 AND w.startdatum <= ?
      GROUP BY wt.taak_id
    `).all(startdatum);
    const kaart = new Map();
    for (const r of rijen) {
      kaart.set(r.taakId, {
        laatsteStartdatum: r.laatsteStart,
        wekenGeleden: wekenTussen(r.laatsteStart, startdatum),
      });
    }
    return kaart;
  },

  /** Historie van één taak: in welke weken was hij ingepland en afgevinkt. */
  historie(taakId, limiet = 26) {
    return db.prepare(`
      SELECT w.jaar, w.weeknummer, w.startdatum, wt.afgevinkt, wt.afgevinkt_op AS afgevinktOp, wt.opmerking
      FROM weektaken wt
      JOIN weken w ON w.id = wt.week_id
      WHERE wt.taak_id = ?
      ORDER BY w.startdatum DESC
      LIMIT ?
    `).all(taakId, limiet).map((r) => ({ ...r, afgevinkt: !!r.afgevinkt }));
  },
};

function normaliseerTaak(t) {
  return {
    id: t.id,
    titel: t.titel,
    ruimteId: t.ruimteId,
    ruimteNaam: t.ruimteNaam,
    omschrijving: t.omschrijving,
    fotoId: t.fotoId,
    standaardFrequentie: t.standaardFrequentie,
    geschatteMinuten: t.geschatteMinuten,
    volgorde: t.volgorde,
    actief: !!t.actief,
  };
}

/* -------------------------------------------------------------------- weken */

export const weken = {
  haalOfMaak(jaar, weeknummer) {
    const bestaand = db.prepare('SELECT * FROM weken WHERE jaar = ? AND weeknummer = ?').get(jaar, weeknummer);
    if (bestaand) return normaliseerWeek(bestaand);
    const startdatum = alsDatumTekst(startdatumVanWeek(jaar, weeknummer));
    db.prepare('INSERT INTO weken (jaar, weeknummer, startdatum, notitie, aangemaakt_op) VALUES (?, ?, ?, \'\', ?)')
      .run(jaar, weeknummer, startdatum, nu());
    return normaliseerWeek(db.prepare('SELECT * FROM weken WHERE jaar = ? AND weeknummer = ?').get(jaar, weeknummer));
  },

  haal(jaar, weeknummer) {
    const w = db.prepare('SELECT * FROM weken WHERE jaar = ? AND weeknummer = ?').get(jaar, weeknummer);
    return w ? normaliseerWeek(w) : null;
  },

  haalOpId(id) {
    const w = db.prepare('SELECT * FROM weken WHERE id = ?').get(id);
    return w ? normaliseerWeek(w) : null;
  },

  huidige() {
    const { jaar, weeknummer } = huidigeWeek();
    return this.haalOfMaak(jaar, weeknummer);
  },

  zetNotitie(id, notitie) {
    db.prepare('UPDATE weken SET notitie = ? WHERE id = ?').run(String(notitie ?? ''), id);
    return this.haalOpId(id);
  },

  /** Zet precies deze taken voor de week; behoudt afvinkjes van taken die blijven. */
  zetTaken(weekId, taakIds) {
    const gewenst = new Set(taakIds.map(Number));
    inTransactie(() => {
      const bestaand = db.prepare('SELECT id, taak_id AS taakId FROM weektaken WHERE week_id = ?').all(weekId);
      const bestaandeIds = new Set(bestaand.map((r) => r.taakId));
      const verwijder = db.prepare('DELETE FROM weektaken WHERE week_id = ? AND taak_id = ?');
      for (const r of bestaand) if (!gewenst.has(r.taakId)) verwijder.run(weekId, r.taakId);
      const voegToe = db.prepare('INSERT INTO weektaken (week_id, taak_id) VALUES (?, ?)');
      for (const taakId of gewenst) if (!bestaandeIds.has(taakId)) voegToe.run(weekId, taakId);
    });
    return this.taken(weekId);
  },

  /** Weektaken inclusief taakgegevens, in weergavevolgorde. */
  taken(weekId) {
    return db.prepare(`
      SELECT wt.id, wt.taak_id AS taakId, wt.afgevinkt, wt.afgevinkt_op AS afgevinktOp, wt.opmerking,
             t.titel, t.omschrijving, t.foto_id AS fotoId, t.geschatte_minuten AS geschatteMinuten,
             r.id AS ruimteId, r.naam AS ruimteNaam
      FROM weektaken wt
      JOIN taken t   ON t.id = wt.taak_id
      JOIN ruimtes r ON r.id = t.ruimte_id
      WHERE wt.week_id = ?
      ORDER BY r.volgorde, r.id, t.volgorde, t.id
    `).all(weekId).map((r) => ({ ...r, afgevinkt: !!r.afgevinkt }));
  },

  /** Taken van de vorige week overnemen (afvinkjes niet). */
  kopieerVorigeWeek(weekId) {
    const week = this.haalOpId(weekId);
    if (!week) return null;
    const vorige = vorigeWeek(week.jaar, week.weeknummer);
    const bron = this.haal(vorige.jaar, vorige.weeknummer);
    if (!bron) return { gekopieerd: 0, taken: this.taken(weekId) };
    const taakIds = db.prepare(`
      SELECT wt.taak_id AS taakId FROM weektaken wt
      JOIN taken t ON t.id = wt.taak_id
      WHERE wt.week_id = ? AND t.actief = 1
    `).all(bron.id).map((r) => r.taakId);
    const resultaat = this.zetTaken(weekId, taakIds);
    return { gekopieerd: taakIds.length, taken: resultaat };
  },

  /** Laatste N weken met voortgang, nieuwste eerst. */
  historie(limiet = 12) {
    return db.prepare(`
      SELECT w.id, w.jaar, w.weeknummer, w.startdatum, w.notitie,
             COUNT(wt.id) AS gepland,
             COALESCE(SUM(wt.afgevinkt), 0) AS afgevinkt
      FROM weken w
      LEFT JOIN weektaken wt ON wt.week_id = w.id
      GROUP BY w.id
      HAVING gepland > 0 OR w.notitie <> ''
      ORDER BY w.startdatum DESC
      LIMIT ?
    `).all(limiet);
  },

  lijst(limiet = 60) {
    return db.prepare('SELECT * FROM weken ORDER BY startdatum DESC LIMIT ?').all(limiet).map(normaliseerWeek);
  },
};

function normaliseerWeek(w) {
  return {
    id: w.id, jaar: w.jaar, weeknummer: w.weeknummer,
    startdatum: w.startdatum, notitie: w.notitie, aangemaaktOp: w.aangemaakt_op,
  };
}

/* ---------------------------------------------------------------- weektaken */

export const weektaken = {
  haal(id) {
    const r = db.prepare('SELECT * FROM weektaken WHERE id = ?').get(id);
    if (!r) return null;
    return {
      id: r.id, weekId: r.week_id, taakId: r.taak_id,
      afgevinkt: !!r.afgevinkt, afgevinktOp: r.afgevinkt_op, opmerking: r.opmerking,
    };
  },

  zetAfgevinkt(id, afgevinkt) {
    const tijd = afgevinkt ? nu() : null;
    db.prepare('UPDATE weektaken SET afgevinkt = ?, afgevinkt_op = ? WHERE id = ?')
      .run(afgevinkt ? 1 : 0, tijd, id);
    return this.haal(id);
  },

  zetOpmerking(id, opmerking) {
    db.prepare('UPDATE weektaken SET opmerking = ? WHERE id = ?').run(String(opmerking ?? '').slice(0, 2000), id);
    return this.haal(id);
  },

  /** Alle opmerkingen die de schoonmaakster achterliet, nieuwste eerst. */
  opmerkingen(limiet = 100) {
    return db.prepare(`
      SELECT wt.id, wt.opmerking, wt.afgevinkt, wt.afgevinkt_op AS afgevinktOp,
             t.titel, r.naam AS ruimteNaam, w.jaar, w.weeknummer, w.startdatum
      FROM weektaken wt
      JOIN taken t   ON t.id = wt.taak_id
      JOIN ruimtes r ON r.id = t.ruimte_id
      JOIN weken w   ON w.id = wt.week_id
      WHERE TRIM(wt.opmerking) <> ''
      ORDER BY w.startdatum DESC, r.volgorde, t.volgorde
      LIMIT ?
    `).all(limiet).map((r) => ({ ...r, afgevinkt: !!r.afgevinkt }));
  },
};

/* --------------------------------------------------------------- berichten */

export const berichten = {
  maak({ weekId = null, afzender, tekst, clientId = null }) {
    // clientId maakt opnieuw versturen na een netwerkfout onschadelijk.
    if (clientId) {
      const bestaand = db.prepare('SELECT id FROM berichten WHERE client_id = ?').get(clientId);
      if (bestaand) return this.haal(bestaand.id);
    }
    const id = db.prepare(`
      INSERT INTO berichten (week_id, afzender, tekst, aangemaakt_op, gelezen, client_id)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(weekId, afzender, String(tekst).trim().slice(0, 2000), nu(), clientId).lastInsertRowid;
    return this.haal(id);
  },

  haal(id) {
    const b = db.prepare(`
      SELECT b.id, b.week_id AS weekId, b.afzender, b.tekst, b.aangemaakt_op AS aangemaaktOp, b.gelezen,
             w.jaar, w.weeknummer
      FROM berichten b LEFT JOIN weken w ON w.id = b.week_id WHERE b.id = ?
    `).get(id);
    return b ? { ...b, gelezen: !!b.gelezen } : null;
  },

  lijst({ limiet = 100, weekId = null } = {}) {
    const waar = weekId ? 'WHERE b.week_id = ?' : '';
    const params = weekId ? [weekId, limiet] : [limiet];
    return db.prepare(`
      SELECT b.id, b.week_id AS weekId, b.afzender, b.tekst, b.aangemaakt_op AS aangemaaktOp, b.gelezen,
             w.jaar, w.weeknummer
      FROM berichten b LEFT JOIN weken w ON w.id = b.week_id
      ${waar}
      ORDER BY b.aangemaakt_op DESC
      LIMIT ?
    `).all(...params).map((b) => ({ ...b, gelezen: !!b.gelezen }));
  },

  aantalOngelezen(voorRol) {
    const andere = voorRol === 'beheerder' ? 'schoonmaakster' : 'beheerder';
    return db.prepare('SELECT COUNT(*) AS n FROM berichten WHERE gelezen = 0 AND afzender = ?').get(andere).n;
  },

  markeerGelezen(id, gelezen = true) {
    db.prepare('UPDATE berichten SET gelezen = ? WHERE id = ?').run(gelezen ? 1 : 0, id);
    return this.haal(id);
  },

  markeerAllesGelezen(afzender) {
    db.prepare('UPDATE berichten SET gelezen = 1 WHERE afzender = ?').run(afzender);
    return true;
  },
};

/* ---------------------------------------------------------------- samengesteld */

/** Alles wat een weergave van één week nodig heeft, in één keer. */
export function weekOverzicht(jaar, weeknummer, { maakAan = false } = {}) {
  const week = maakAan ? weken.haalOfMaak(jaar, weeknummer) : weken.haal(jaar, weeknummer);
  if (!week) {
    const startdatum = alsDatumTekst(startdatumVanWeek(jaar, weeknummer));
    return {
      week: { id: null, jaar, weeknummer, startdatum, notitie: '' },
      taken: [], groepen: [], voortgang: { gedaan: 0, totaal: 0 }, berichten: [],
    };
  }
  const lijst = weken.taken(week.id);
  const groepen = groepeerPerRuimte(lijst);
  const gedaan = lijst.filter((t) => t.afgevinkt).length;
  return {
    week,
    taken: lijst,
    groepen,
    voortgang: { gedaan, totaal: lijst.length },
    berichten: berichten.lijst({ weekId: week.id, limiet: 50 }),
  };
}

export function groepeerPerRuimte(lijst) {
  const groepen = [];
  const index = new Map();
  for (const item of lijst) {
    if (!index.has(item.ruimteId)) {
      const groep = { ruimteId: item.ruimteId, ruimteNaam: item.ruimteNaam, taken: [] };
      index.set(item.ruimteId, groep);
      groepen.push(groep);
    }
    index.get(item.ruimteId).taken.push(item);
  }
  return groepen;
}

/** Bibliotheek + selectie + "hoe lang geleden" voor de week-samensteller. */
export function weekSamensteller(jaar, weeknummer) {
  const week = weken.haalOfMaak(jaar, weeknummer);
  const geselecteerd = new Set(weken.taken(week.id).map((t) => t.taakId));
  const laatst = taken.laatstGedaan(week.startdatum);
  const alle = taken.lijst().map((t) => {
    const info = laatst.get(t.id);
    return {
      ...t,
      geselecteerd: geselecteerd.has(t.id),
      wekenGeleden: info ? info.wekenGeleden : null,
      laatsteStartdatum: info ? info.laatsteStartdatum : null,
    };
  });
  return {
    week,
    groepen: groepeerPerRuimte(alle),
    aantalGeselecteerd: geselecteerd.size,
    // De browser hoeft zo zelf geen ISO-weken uit te rekenen.
    navigatie: {
      vorige: vorigeWeek(jaar, weeknummer),
      volgende: volgendeWeek(jaar, weeknummer),
      huidige: (({ jaar: j, weeknummer: w }) => ({ jaar: j, weeknummer: w }))(huidigeWeek()),
    },
  };
}

export { huidigeWeek, isoWeek, uitDatumTekst };
