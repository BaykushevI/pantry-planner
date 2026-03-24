CREATE TABLE purchase_events (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  purchased_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
