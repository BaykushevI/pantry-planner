# Pantry Planner

Pantry Planner is a **Personal Shopping Memory App** — a Level 2 architecture portfolio project that demonstrates service extraction, async processing, queue-based flows, scheduled jobs, retry handling, and operational visibility.

The project is intentionally lightweight, practical, and explainable. The goal is not a heavy enterprise platform, but clean architectural thinking, meaningful service extraction, and disciplined product logic.

---

## Table of Contents

- [Product Direction](#product-direction)
- [Architecture Overview](#architecture-overview)
- [Data Model](#data-model)
- [Auth Model](#auth-model)
- [Async Flows](#async-flows)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Local Development](#local-development)
- [Current Status](#current-status)
- [What L2 Demonstrates](#what-l2-demonstrates)

---

## Product Direction

Pantry Planner is a **Personal Shopping Memory App**.

Every user has:

1. **Current Shopping List** — items currently on their list (status: `active`)
2. **Suggested Items** — cadence-driven restock suggestions based on purchase history
3. **Known Items** — previously bought or added items, available for quick re-adding (status: `history`)

The app remembers what was bought, learns cadence patterns from purchase history, suggests when to restock, and allows quick re-adding of known products.

### Key Behaviors

- Add to list → item becomes `active`
- Remove from list → item becomes `history`, no purchase event recorded
- Bought → item becomes `history`, purchase event recorded, shopping session updated
- Re-add known item → same logical item reactivated (no duplicate created)
- Suggestions → driven by cadence calculated from purchase history
- Known Items → `history` items not currently in suggestions

### Notes replace quantity

The `notes` field is the primary user-facing descriptor. Examples: `"2 litres"`, `"3 bananas"`, `"organic if available"`. When re-adding a known item, the last used notes are suggested as default.

---

## Architecture Overview

```
Web App → API Worker → D1 (SQLite)
                    → Queue → Notifications Worker
Scheduler Worker   → Queue → Notifications Worker
```

### Components

#### Web App
- React + Vite + TypeScript
- Login screen → user-scoped session in React state
- Sections: Current Shopping List, Suggested Items, Known Items
- Add form with autocomplete from known items
- Bought / Remove / Snooze / Re-add actions

#### Main API Worker
- User-scoped domain logic
- Auth: `POST /auth/login` validates credentials, returns user object
- All endpoints require `X-User-Id` header (validated against DB)
- Item CRUD, purchase history, suggestions, summary

#### Scheduler Worker
- Time-based job producer
- Iterates all users — no hardcoded user
- Daily digest + refill reminder jobs per user
- Cron: `0 8 * * *`

#### Notifications Worker
- Async queue consumer
- Processes `DAILY_DIGEST` and `REFILL_REMINDER` jobs
- Simulates 30% failure rate for retry demonstration
- Persists all attempts with status tracking

#### Queue
- Decouples background processing from synchronous flows

#### D1
- Tables: `users`, `pantry_items`, `purchase_events`, `shopping_sessions`, `notification_attempts`

---

## Data Model

### Item Status Model

| Status | Meaning |
|--------|---------|
| `active` | Currently on the shopping list |
| `history` | Known item, not on list |

Items are never hard-deleted in normal flows.

### Item Identity

Items are identified per-user by normalized name (trimmed, case-insensitive). If a `history` item is re-added, the same logical item is reactivated — no duplicate created.

### Cadence Logic

```
cadence = average days between consecutive purchase events
```

- Requires ≥ 2 purchase events
- Items without sufficient history appear in Known Items but not in Suggestions
- Suggestions: items due (days since last bought ≥ cadence) or due soon (1 day before)

### Key Fields (pantry_items)

| Field | Description |
|-------|-------------|
| `id` | UUID |
| `user_id` | Owner (references `users`) |
| `name` | Normalized item name |
| `status` | `active` or `history` |
| `notes` | Free-text descriptor (replaces quantity/unit) |
| `last_bought_at` | Timestamp of last purchase event |
| `snoozed_until` | Suppress from suggestions until this date |

---

## Auth Model

Simple credential-based auth for a demo app. Not enterprise auth.

- `POST /auth/login` validates `username` + `password` against the `users` table
- Returns `{ id, username, displayName }` on success
- Frontend stores the user object in React state (in-memory, lost on page refresh)
- All protected endpoints require `X-User-Id` header
- API validates the header against the `users` table on every request

### Demo Users

| Username | Password | Display Name |
|----------|----------|--------------|
| `alice` | `alice123` | Alice |
| `bob` | `bob123` | Bob |

Each user has fully isolated data: own shopping list, known items, suggestions, purchase history, and shopping sessions.

> Passwords are stored as plaintext — intentionally, for demo simplicity. Production would use bcrypt or similar.

---

## Async Flows

### 1. Scheduler-Driven Daily Digest

```
Scheduler (cron 8am) → iterates all users → DAILY_DIGEST per user → Queue → Notifications Worker
```

### 2. Scheduler-Driven Refill Reminders

```
Scheduler → per-user cadence evaluation → REFILL_REMINDER per due item → Queue → Notifications Worker
Deduplication: skips items already reminded today (via notification_attempts)
```

### 3. Bought Action (API-Triggered)

```
User marks item as bought → API → purchase event recorded → REFILL_REMINDER enqueued → Queue → Notifications Worker
```

---

## Technology Stack

- **Frontend:** React + Vite + TypeScript
- **Main API:** Cloudflare Workers + TypeScript
- **Scheduler:** Cloudflare Worker with cron support
- **Background Processing:** Cloudflare Queues
- **Storage:** Cloudflare D1 (SQLite)
- **CI:** GitHub Actions
- **Local Dev:** Wrangler shared persist state

---

## Repository Structure

```
apps/
  web/          React frontend
  api/          Main API worker
  notifications/ Queue consumer worker
  scheduler/    Cron job producer worker

packages/
  shared/       Shared types and contracts

docs/
  architecture/
  setup/
  deployment/
  roadmap/

infra/
  d1/migrations/  D1 schema migrations
```

---

## Local Development

### Install

```bash
pnpm install
```

### Run migrations (first time or after schema changes)

```bash
npx wrangler d1 execute pantry-planner-db --local \
  --persist-to .wrangler/state \
  --file=infra/d1/migrations/0006_users_and_model_update.sql
```

### API + Notifications (port 8787)

```bash
cd apps/api
npx wrangler dev \
  -c wrangler.jsonc \
  -c ../notifications/wrangler.jsonc \
  --persist-to ../../.wrangler/state \
  --port 8787
```

### Scheduler + Notifications (port 8790)

```bash
cd apps/scheduler
npx wrangler dev \
  -c wrangler.jsonc \
  -c ../notifications/wrangler.jsonc \
  --persist-to ../../.wrangler/state \
  --port 8790 \
  --test-scheduled
```

### Frontend (port 5173)

```bash
cd apps/web
pnpm dev
```

> All workers must use `--persist-to ../../.wrangler/state` to share the same D1 database locally.

---

## Current Status

- [x] DB migrations with user scoping
- [x] Demo users seeded (alice, bob)
- [x] Simple login / credential auth
- [x] User-scoped shopping list (active/history model)
- [x] Notes field replaces quantity/unit
- [x] Item re-activation (no hard delete, no duplicate)
- [x] Autocomplete from known items
- [x] Cadence-driven suggestions (purchase history based)
- [x] Shopping session awareness
- [x] Per-user scheduler (daily digest + refill reminders)
- [x] Retry and failure simulation
- [x] Notification attempt persistence
- [x] Same-day reminder dedupe
- [x] Clean multi-section UI

---

## What L2 Demonstrates

- meaningful service extraction (3 workers + shared queue)
- async background processing with retry logic
- queue-based decoupling
- scheduled job orchestration per user
- operational traceability (persisted attempts)
- behavior-driven product logic (cadence from purchase history)
- status-based item lifecycle (no hard delete)
- disciplined monorepo implementation

---

## Quick Links

- [Architecture v1](docs/architecture/architecture-v1.md)
- [Local Setup](docs/setup/local-setup.md)
- [Local Development](docs/setup/local-development.md)
- [Deployment Notes](docs/deployment/deployment-notes.md)
