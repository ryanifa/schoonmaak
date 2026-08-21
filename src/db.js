import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export const db = new DatabaseSync(config.dbPad);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS ruimtes (
    id        INTEGER PRIMARY KEY,
    naam      TEXT    NOT NULL,
    volgorde  INTEGER NOT NULL DEFAULT 0,
    actief    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS fotos (
    id            INTEGER PRIMARY KEY,
    mime          TEXT    NOT NULL,
    bytes         INTEGER NOT NULL,
    data          BLOB    NOT NULL,
    aangemaakt_op TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS taken (
    id                   INTEGER PRIMARY KEY,
    titel                TEXT    NOT NULL,
    ruimte_id            INTEGER NOT NULL REFERENCES ruimtes(id),
    omschrijving         TEXT    NOT NULL DEFAULT '',
    foto_id              INTEGER REFERENCES fotos(id),
    standaard_frequentie TEXT    NOT NULL DEFAULT 'wekelijks',
    geschatte_minuten    INTEGER,
    volgorde             INTEGER NOT NULL DEFAULT 0,
    actief               INTEGER NOT NULL DEFAULT 1,
    aangemaakt_op        TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weken (
    id            INTEGER PRIMARY KEY,
    jaar          INTEGER NOT NULL,
    weeknummer    INTEGER NOT NULL,
    startdatum    TEXT    NOT NULL,
    notitie       TEXT    NOT NULL DEFAULT '',
    aangemaakt_op TEXT    NOT NULL,
    UNIQUE (jaar, weeknummer)
  );

  CREATE TABLE IF NOT EXISTS weektaken (
    id           INTEGER PRIMARY KEY,
    week_id      INTEGER NOT NULL REFERENCES weken(id) ON DELETE CASCADE,
    taak_id      INTEGER NOT NULL REFERENCES taken(id),
    afgevinkt    INTEGER NOT NULL DEFAULT 0,
    afgevinkt_op TEXT,
    opmerking    TEXT    NOT NULL DEFAULT '',
    UNIQUE (week_id, taak_id)
  );

  CREATE TABLE IF NOT EXISTS berichten (
    id            INTEGER PRIMARY KEY,
    week_id       INTEGER REFERENCES weken(id) ON DELETE SET NULL,
    afzender      TEXT    NOT NULL,
    tekst         TEXT    NOT NULL,
    aangemaakt_op TEXT    NOT NULL,
    gelezen       INTEGER NOT NULL DEFAULT 0,
    client_id     TEXT UNIQUE
  );

  CREATE INDEX IF NOT EXISTS idx_taken_ruimte    ON taken (ruimte_id, volgorde);
  CREATE INDEX IF NOT EXISTS idx_weektaken_week  ON weektaken (week_id);
  CREATE INDEX IF NOT EXISTS idx_weektaken_taak  ON weektaken (taak_id);
  CREATE INDEX IF NOT EXISTS idx_berichten_tijd  ON berichten (aangemaakt_op DESC);
`);

// Kleine, idempotente migraties voor databases van een oudere versie.
for (const [tabel, kolom, definitie] of [
  ['berichten', 'client_id', 'TEXT'],
]) {
  const kolommen = db.prepare(`PRAGMA table_info(${tabel})`).all().map((k) => k.name);
  if (!kolommen.includes(kolom)) db.exec(`ALTER TABLE ${tabel} ADD COLUMN ${kolom} ${definitie}`);
}

export function nu() {
  return new Date().toISOString();
}

/** Voert `fn` uit binnen één transactie. */
export function inTransactie(fn) {
  db.exec('BEGIN');
  try {
    const resultaat = fn();
    db.exec('COMMIT');
    return resultaat;
  } catch (fout) {
    db.exec('ROLLBACK');
    throw fout;
  }
}
