-- Why: reader comments are kept here until Victor approves them in the studio. The email is stored for him
-- alone and is never part of any public reply. A refused comment is deleted, so nothing unwanted is kept.
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  email      TEXT,
  body       TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  decided_at TEXT
);

CREATE INDEX IF NOT EXISTS comments_by_post ON comments (slug, status, created_at);
CREATE INDEX IF NOT EXISTS comments_by_status ON comments (status, created_at);
