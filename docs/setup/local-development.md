# Local Development

## 1. Purpose

This document explains how to run Pantry Planner locally with shared D1 and Queue state.

---

## 2. Shared Local State Rule

All workers must use the same local persistence path:

```bash
--persist-to ../../.wrangler/state
```

This is critical for:
- D1 database sharing between workers
- Queue state sharing
- Running API + Notifications or Scheduler + Notifications together

Without a shared path, each worker operates against a separate local database instance.

---

## 3. Apply Migrations (First Time / After Schema Changes)

Run all migrations in order from the repo root:

```bash
npx wrangler d1 execute pantry-planner-db \
  --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0001_initial_schema.sql

npx wrangler d1 execute pantry-planner-db \
  --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0002_add_snooze.sql

npx wrangler d1 execute pantry-planner-db \
  --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0003_add_purchase_events.sql

npx wrangler d1 execute pantry-planner-db \
  --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0004_add_shopping_sessions.sql

npx wrangler d1 execute pantry-planner-db \
  --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0005_add_notification_attempts.sql

npx wrangler d1 execute pantry-planner-db \
  --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0006_users_and_model_update.sql
```

Migration 0006 creates the `users` table and seeds demo users (alice, bob).

---

## 4. Run API + Notifications (port 8787)

```bash
cd apps/api

npx wrangler dev \
  -c wrangler.jsonc \
  -c ../notifications/wrangler.jsonc \
  --persist-to ../../.wrangler/state \
  --port 8787
```

Use this for:
- all API endpoints
- login / auth validation
- queue producer + consumer validation

---

## 5. Run Scheduler + Notifications (port 8790)

```bash
cd apps/scheduler

npx wrangler dev \
  -c wrangler.jsonc \
  -c ../notifications/wrangler.jsonc \
  --persist-to ../../.wrangler/state \
  --port 8790 \
  --test-scheduled
```

Use this for:
- manual scheduler endpoints
- cron trigger testing
- per-user digest + reminder validation

---

## 6. Run Frontend (port 5173)

```bash
cd apps/web
pnpm dev
```

The frontend connects to `http://localhost:8787` (API).

---

## 7. Trigger Scheduled Handler Manually

When using `--test-scheduled`:

```bash
curl "http://localhost:8790/__scheduled?cron=0+8+*+*+*"
```

---

## 8. Useful Endpoints

### API (port 8787)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/login` | Returns user object |
| GET | `/items` | Requires `X-User-Id` header |
| GET | `/items?status=active` | Current shopping list |
| GET | `/items?status=history` | Known items |
| GET | `/items/autocomplete?q=` | Requires `X-User-Id` |
| POST | `/items` | Add / re-activate item |
| POST | `/items/:id/bought` | Mark bought (→ history + purchase event) |
| POST | `/items/:id/remove` | Remove from list (→ history, no purchase event) |
| POST | `/items/:id/snooze` | Snooze suggestion for 1 day |
| PATCH | `/items/:id/notes` | Update notes |
| GET | `/suggestions` | Cadence-driven suggestions |
| GET | `/summary/daily` | Daily summary counts |
| GET | `/notifications/history` | Last 20 async attempts |

### Scheduler (port 8790)

| Method | Path |
|--------|------|
| GET | `/health` |
| GET | `/run-daily-digest` |
| GET | `/run-refill-reminders` |

---

## 9. Demo Users

| Username | Password |
|----------|----------|
| `alice` | `alice123` |
| `bob` | `bob123` |

Each user has isolated data. Login via the web UI or directly via `POST /auth/login`.

---

## 10. Development Rhythm

1. Apply migrations if schema changed
2. Start API + Notifications worker
3. Login as alice or bob
4. Add items, mark as bought, observe suggestions building up
5. Validate via `requests.http` for raw API testing
6. Run scheduler to trigger async flows
7. Check `/notifications/history` for attempt records
8. Commit after each working checkpoint
