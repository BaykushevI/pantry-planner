CREATE TABLE pantry_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  last_bought_at TEXT,
  refill_frequency_days INTEGER,
  low_stock_threshold REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  reminders_enabled INTEGER NOT NULL DEFAULT 1,
  daily_digest_enabled INTEGER NOT NULL DEFAULT 1,
  weekly_digest_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
