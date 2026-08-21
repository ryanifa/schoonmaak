// HTTP-laag: vertaalt verzoeken naar aanroepen op de datalaag.
import { config } from './config.js';
import {
  ruimtes, taken, weken, weektaken, berichten,
  weekOverzicht, weekSamensteller, huidigeWeek, FREQUENTIES,
} from './repo.js';
import { db, nu } from './db.js';

class HttpFout extends Error {
  constructor(status, boodschap) {
    super(boodschap);
    this.status = status;
  }
}

const alleenBeheerder = (ctx) => {
  if (ctx.rol !== 'beheerder') throw new HttpFout(403, 'Alleen de beheerder mag dit.');
};

const getal = (waarde, naam) => {
  const n = Number(waarde);
  if (!Number.isInteger(n)) throw new HttpFout(400, `Ongeldige ${naam}.`);
  return n;
};

const tekst = (waarde, naam, { max = 200, verplicht = true } = {}) => {
  const s = String(waarde ?? '').trim();
  if (verplicht && !s) throw new HttpFout(400, `${naam} mag niet leeg zijn.`);
  return s.slice(0, max);
};

/**
 * Routetabel. Elke sleutel is `METHODE /pad/met/:parameters`.
 * Handlers krijgen ({ ctx, params, body, query }) en geven JSON terug.
 */
export const routes = {
  /* --- start / configuratie --- */

  'GET /api/start': ({ ctx }) => {
    const hw = huidigeWeek();
    return {
      rol: ctx.rol,
      huidigeWeek: hw,
      ongelezenBerichten: berichten.aantalOngelezen(ctx.rol),
      frequenties: FREQUENTIES,
      serverTijd: nu(),
    };
  },

  /* --- ruimtes --- */

  'GET /api/ruimtes': ({ query }) => ({
    ruimtes: ruimtes.lijst({ inclusiefGearchiveerd: query.alles === '1' }),
  }),

  'POST /api/ruimtes': ({ ctx, body }) => {
    alleenBeheerder(ctx);
    return { ruimte: ruimtes.maak({ naam: tekst(body.naam, 'Naam', { max: 60 }) }) };
  },

  'PUT /api/ruimtes/:id': ({ ctx, params, body }) => {
    alleenBeheerder(ctx);
    const ruimte = ruimtes.bewerk(getal(params.id, 'id'), {
      naam: body.naam === undefined ? undefined : tekst(body.naam, 'Naam', { max: 60 }),
      actief: body.actief,
    });
    if (!ruimte) throw new HttpFout(404, 'Ruimte niet gevonden.');
    return { ruimte };
  },

  'POST /api/ruimtes/volgorde': ({ ctx, body }) => {
    alleenBeheerder(ctx);
    if (!Array.isArray(body.ids)) throw new HttpFout(400, 'ids ontbreekt.');
    return { ruimtes: ruimtes.herorden(body.ids.map((i) => getal(i, 'id'))) };
  },

  /* --- taken --- */

  'GET /api/taken': ({ query }) => ({
    taken: taken.lijst({ inclusiefGearchiveerd: query.alles === '1' }),
    ruimtes: ruimtes.lijst({ inclusiefGearchiveerd: query.alles === '1' }),
  }),

  'POST /api/taken': ({ ctx, body }) => {
    alleenBeheerder(ctx);
    const ruimteId = getal(body.ruimteId, 'ruimteId');
    if (!ruimtes.haal(ruimteId)) throw new HttpFout(400, 'Onbekende ruimte.');
    return {
      taak: taken.maak({
        titel: tekst(body.titel, 'Titel', { max: 120 }),
        ruimteId,
        omschrijving: tekst(body.omschrijving, 'Omschrijving', { max: 2000, verplicht: false }),
        fotoId: body.fotoId ? getal(body.fotoId, 'fotoId') : null,
        standaardFrequentie: body.standaardFrequentie,
        geschatteMinuten: body.geschatteMinuten,
      }),
    };
  },

  'PUT /api/taken/:id': ({ ctx, params, body }) => {
    alleenBeheerder(ctx);
    const velden = {};
    if (body.titel !== undefined) velden.titel = tekst(body.titel, 'Titel', { max: 120 });
    if (body.ruimteId !== undefined) velden.ruimteId = getal(body.ruimteId, 'ruimteId');
    if (body.omschrijving !== undefined) velden.omschrijving = tekst(body.omschrijving, 'Omschrijving', { max: 2000, verplicht: false });
    if (body.fotoId !== undefined) velden.fotoId = body.fotoId === null ? null : getal(body.fotoId, 'fotoId');
    if (body.standaardFrequentie !== undefined) velden.standaardFrequentie = body.standaardFrequentie;
    if (body.geschatteMinuten !== undefined) velden.geschatteMinuten = body.geschatteMinuten;
    if (body.actief !== undefined) velden.actief = !!body.actief;
    const taak = taken.bewerk(getal(params.id, 'id'), velden);
    if (!taak) throw new HttpFout(404, 'Taak niet gevonden.');
    return { taak };
  },

  'POST /api/taken/volgorde': ({ ctx, body }) => {
    alleenBeheerder(ctx);
    if (!Array.isArray(body.ids)) throw new HttpFout(400, 'ids ontbreekt.');
    taken.herorden(body.ids.map((i) => getal(i, 'id')));
    return { ok: true };
  },

  'GET /api/taken/:id/historie': ({ ctx, params }) => {
    alleenBeheerder(ctx);
    const id = getal(params.id, 'id');
    const taak = taken.haal(id);
    if (!taak) throw new HttpFout(404, 'Taak niet gevonden.');
    return { taak, historie: taken.historie(id) };
  },

  /* --- weken --- */

  'GET /api/week/:jaar/:weeknummer': ({ query, params }) => weekOverzicht(
    getal(params.jaar, 'jaar'),
    getal(params.weeknummer, 'weeknummer'),
    { maakAan: query.maak === '1' },
  ),

  'GET /api/samensteller/:jaar/:weeknummer': ({ ctx, params }) => {
    alleenBeheerder(ctx);
    return weekSamensteller(getal(params.jaar, 'jaar'), getal(params.weeknummer, 'weeknummer'));
  },

  'PUT /api/weken/:id/notitie': ({ ctx, params, body }) => {
    alleenBeheerder(ctx);
    const week = weken.zetNotitie(getal(params.id, 'id'), tekst(body.notitie, 'Notitie', { max: 1000, verplicht: false }));
    if (!week) throw new HttpFout(404, 'Week niet gevonden.');
    return { week };
  },

  'PUT /api/weken/:id/taken': ({ ctx, params, body }) => {
    alleenBeheerder(ctx);
    if (!Array.isArray(body.taakIds)) throw new HttpFout(400, 'taakIds ontbreekt.');
    const weekId = getal(params.id, 'id');
    if (!weken.haalOpId(weekId)) throw new HttpFout(404, 'Week niet gevonden.');
    weken.zetTaken(weekId, body.taakIds.map((i) => getal(i, 'taakId')));
    const week = weken.haalOpId(weekId);
    return weekSamensteller(week.jaar, week.weeknummer);
  },

  'POST /api/weken/:id/kopieer-vorige': ({ ctx, params }) => {
    alleenBeheerder(ctx);
    const weekId = getal(params.id, 'id');
    const resultaat = weken.kopieerVorigeWeek(weekId);
    if (!resultaat) throw new HttpFout(404, 'Week niet gevonden.');
    const week = weken.haalOpId(weekId);
    return { gekopieerd: resultaat.gekopieerd, ...weekSamensteller(week.jaar, week.weeknummer) };
  },

  'GET /api/historie': ({ ctx, query }) => {
    alleenBeheerder(ctx);
    return { weken: weken.historie(Math.min(Number(query.limiet) || 12, 60)) };
  },

  /* --- afvinken en opmerkingen --- */

  'POST /api/weektaken/:id/afvinken': ({ params, body }) => {
    const id = getal(params.id, 'id');
    if (!weektaken.haal(id)) throw new HttpFout(404, 'Deze taak staat niet meer op de weeklijst.');
    return { weektaak: weektaken.zetAfgevinkt(id, !!body.afgevinkt) };
  },

  'PUT /api/weektaken/:id/opmerking': ({ params, body }) => {
    const id = getal(params.id, 'id');
    if (!weektaken.haal(id)) throw new HttpFout(404, 'Deze taak staat niet meer op de weeklijst.');
    return { weektaak: weektaken.zetOpmerking(id, body.opmerking) };
  },

  'GET /api/opmerkingen': ({ ctx }) => {
    alleenBeheerder(ctx);
    return { opmerkingen: weektaken.opmerkingen() };
  },

  /* --- berichten --- */

  'GET /api/berichten': ({ query }) => ({
    berichten: berichten.lijst({
      limiet: Math.min(Number(query.limiet) || 100, 200),
      weekId: query.weekId ? Number(query.weekId) : null,
    }),
  }),

  'POST /api/berichten': ({ ctx, body }) => ({
    bericht: berichten.maak({
      weekId: body.weekId ? getal(body.weekId, 'weekId') : null,
      afzender: ctx.rol,
      tekst: tekst(body.tekst, 'Bericht', { max: 2000 }),
      clientId: body.clientId ? String(body.clientId).slice(0, 60) : null,
    }),
  }),

  'PUT /api/berichten/:id/gelezen': ({ params, body }) => {
    const bericht = berichten.markeerGelezen(getal(params.id, 'id'), body.gelezen !== false);
    if (!bericht) throw new HttpFout(404, 'Bericht niet gevonden.');
    return { bericht };
  },

  'POST /api/berichten/gelezen-alles': ({ ctx }) => {
    berichten.markeerAllesGelezen(ctx.rol === 'beheerder' ? 'schoonmaakster' : 'beheerder');
    return { ok: true };
  },
};

/* --- foto's --- */

export function fotoOpslaan(buffer, mime) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new HttpFout(400, 'Alleen JPEG, PNG of WebP.');
  }
  if (buffer.length === 0) throw new HttpFout(400, 'Lege foto.');
  if (buffer.length > config.maxFotoBytes) throw new HttpFout(413, 'Foto is te groot.');
  const id = db.prepare('INSERT INTO fotos (mime, bytes, data, aangemaakt_op) VALUES (?, ?, ?, ?)')
    .run(mime, buffer.length, buffer, nu()).lastInsertRowid;
  return { id: Number(id), bytes: buffer.length, mime };
}

export function fotoHalen(id) {
  return db.prepare('SELECT id, mime, bytes, data FROM fotos WHERE id = ?').get(id) || null;
}

export { HttpFout };
