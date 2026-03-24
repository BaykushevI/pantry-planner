CREATE TABLE notification_attempts (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  user_id TEXT,
  item_id TEXT,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL
);
