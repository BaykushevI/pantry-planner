CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

-- Demo users (plaintext passwords — demo only)
INSERT OR IGNORE INTO users (id, username, password, display_name, created_at) VALUES
  ('user_alice', 'alice', 'alice123', 'Alice', '2026-01-01T00:00:00.000Z'),
  ('user_bob',   'bob',   'bob123',   'Bob',   '2026-01-01T00:00:00.000Z');
