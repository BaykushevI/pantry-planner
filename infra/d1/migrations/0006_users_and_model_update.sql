-- Migration 0006: Add users, user-scoping, status model, notes
-- Passwords stored as plaintext — demo app only, not for production

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Seed demo users
INSERT OR IGNORE INTO users (id, username, password, display_name, created_at) VALUES
  ('user_alice', 'alice', 'alice123', 'Alice', '2026-01-01T00:00:00.000Z'),
  ('user_bob',   'bob',   'bob123',   'Bob',   '2026-01-01T00:00:00.000Z');

-- pantry_items: add user scoping, status model, notes
ALTER TABLE pantry_items ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE pantry_items ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE pantry_items ADD COLUMN notes TEXT;

-- Backfill existing items to alice for demo continuity (if any exist)
UPDATE pantry_items SET user_id = 'user_alice' WHERE user_id IS NULL;

-- purchase_events: add user scoping
ALTER TABLE purchase_events ADD COLUMN user_id TEXT REFERENCES users(id);
UPDATE purchase_events SET user_id = 'user_alice' WHERE user_id IS NULL;

-- shopping_sessions: add user scoping
ALTER TABLE shopping_sessions ADD COLUMN user_id TEXT REFERENCES users(id);
UPDATE shopping_sessions SET user_id = 'user_alice' WHERE user_id IS NULL;

-- Note: quantity, unit, refill_frequency_days, low_stock_threshold remain in schema
-- but are no longer used by application logic. SQLite DROP COLUMN would require
-- table rebuild. Leaving them dormant is safe and avoids migration complexity.
