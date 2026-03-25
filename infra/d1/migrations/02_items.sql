CREATE TABLE IF NOT EXISTS pantry_items (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  notes         TEXT,
  last_bought_at TEXT,
  snoozed_until  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_events (
  id           TEXT PRIMARY KEY,
  item_id      TEXT NOT NULL REFERENCES pantry_items(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  purchased_at TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  session_date TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
