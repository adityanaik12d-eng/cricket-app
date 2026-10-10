import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,
  mobile        TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('BATSMAN','BOWLER','KEEPER','ALL_ROUNDER')),
  batting_hand  TEXT NOT NULL DEFAULT 'RHB' CHECK (batting_hand IN ('RHB','LHB')),
  bowling_style TEXT,
  location      TEXT,
  created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  id          TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS match_events (
  match_id     TEXT NOT NULL REFERENCES matches(id),
  seq          INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  ts           TEXT NOT NULL,
  PRIMARY KEY (match_id, seq)
);
CREATE TABLE IF NOT EXISTS otp_codes (
  mobile     TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0
);
`

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  // node:sqlite enables foreign keys by default, but assert it explicitly so
  // referential integrity does not silently depend on a runtime default.
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}
