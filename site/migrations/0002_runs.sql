-- Why: the studio shows agents' runs while they happen. The runner sends each ledger event as it records it,
-- and these two tables keep a live copy: one row per run (where it stands, what it has cost so far) and every
-- event, checked against the chain before it was kept. The ledger files in git stay the record; these tables
-- can be emptied and refilled from them at any time (npm run live:rebuild), so losing them loses nothing.
CREATE TABLE IF NOT EXISTS runs (
  id         TEXT    PRIMARY KEY,
  thought    TEXT    NOT NULL,
  agent      TEXT    NOT NULL,
  state      TEXT    NOT NULL,
  started_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL,
  usd        REAL    NOT NULL DEFAULT 0,
  events     INTEGER NOT NULL DEFAULT 0,
  head       TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS runs_by_time ON runs (updated_at);
CREATE INDEX IF NOT EXISTS runs_by_thought ON runs (thought, updated_at);

CREATE TABLE IF NOT EXISTS run_events (
  run_id TEXT    NOT NULL,
  seq    INTEGER NOT NULL,
  at     TEXT    NOT NULL,
  type   TEXT    NOT NULL,
  hash   TEXT    NOT NULL,
  -- The whole event as the ledger wrote it, so it can be checked again or shown in full.
  event  TEXT    NOT NULL,
  PRIMARY KEY (run_id, seq)
);
