# Pantry Planner — Architecture v1

## 1. Purpose

Pantry Planner is a **Personal Shopping Memory App** and a Level 2 architecture portfolio project. It demonstrates the transition from a simple CRUD app toward a service-based system with background processing, queue-based communication, scheduled jobs, retry handling, and operational visibility.

The system is intentionally lightweight and explainable.

---

## 2. Architecture Goals

- clean service boundaries
- sync vs async responsibility separation
- queue-based decoupling
- scheduled job orchestration
- retry and failure behavior
- practical operational visibility
- behavior-driven reminder logic without overengineering
- user-scoped data model

---

## 3. System Components

### 3.1 Web App

**Role:** user-facing shopping app

**Responsibilities:**
- login screen with credential validation
- current shopping list (active items)
- add item form with known-item autocomplete
- suggested items with urgency badges
- known items catalog with quick re-add
- bought / remove / snooze actions
- user session stored in React state (in-memory)

**Does not own:**
- persistence rules
- cadence logic
- async processing
- background delivery

---

### 3.2 Main API Worker

**Role:** primary domain owner

**Responsibilities:**
- credential validation (`POST /auth/login`)
- user-scoped item CRUD
- item status lifecycle (active ↔ history)
- purchase history recording
- derived cadence calculation
- suggestion generation (cadence-based, history items only)
- daily summary generation
- shopping session management
- known-item autocomplete

**Does not own:**
- job consumption
- retry execution
- notification delivery processing

---

### 3.3 Scheduler Worker

**Role:** time-based producer of background jobs

**Responsibilities:**
- iterate all users from DB (not hardcoded)
- build per-user daily digest payloads
- find per-user refill-due items
- enqueue `DAILY_DIGEST` and `REFILL_REMINDER` jobs
- cron-based orchestration (daily at 8am)

**Does not own:**
- final notification execution
- UI-facing reads
- user interactions

---

### 3.4 Notifications Worker

**Role:** background async consumer

**Responsibilities:**
- consume queue messages
- simulate retry/failure behavior (30% random failure)
- persist all notification attempts with status
- process `DAILY_DIGEST` and `REFILL_REMINDER` job types
- drop jobs after >3 retries (record as DROPPED)

**Does not own:**
- pantry item CRUD
- shopping suggestions
- daily summary calculations for UI

---

### 3.5 Queue

**Role:** transport layer between producers and consumer

**Responsibilities:**
- decouple producers from background processing
- allow eventual processing and retry behavior

---

### 3.6 D1

**Role:** durable application storage

**Tables:**

| Table | Purpose |
|-------|---------|
| `users` | Demo user accounts (id, username, password, display_name) |
| `pantry_items` | User-scoped items with status, notes, last_bought_at |
| `purchase_events` | Per-item purchase history (used for cadence) |
| `shopping_sessions` | Per-user shopping day markers |
| `notification_attempts` | Persisted async attempt records |
| `user_preferences` | Legacy — not currently used |

---

## 4. Domain Model

### 4.1 Item Status Model

Items have two states:

| Status | Meaning |
|--------|---------|
| `active` | On the current shopping list |
| `history` | Known item, not currently on list |

Items are never hard-deleted in normal application flows.

### 4.2 Item Identity

Identity is per-user, matched by normalized name (trimmed + lowercase). This prevents duplicates while allowing re-activation of known items.

- If a `history` item is added again → reactivate it (same ID, no duplicate)
- If an `active` item is added again → return it as-is
- If no item matches → create a new one

### 4.3 Notes Field

`notes` is the primary user-facing descriptor for an item. It replaces the old `quantity` + `unit` model.

Examples: `"2 litres"`, `"3 bananas"`, `"500g, wholegrain"`

When re-adding a known item, the last saved notes are suggested as default.

### 4.4 Purchase Events

Each time an item is marked as "bought":
- a `purchase_event` row is created for that item
- `last_bought_at` is updated on the item
- a shopping session is recorded for today

Purchase events drive the cadence calculation.

### 4.5 Cadence Calculation

```
cadence = average days between consecutive purchase events
```

Requires ≥ 2 purchase events. Items without sufficient history appear in Known Items but are excluded from Suggestions.

### 4.6 Shopping Sessions

A shopping session marks that the user shopped on a given day. This suppresses "due soon" suggestions during an active shopping window, preventing over-eager reminders on days when the user is already shopping.

---

## 5. Auth Model

Simple credential-based auth. Not token-based, not JWT, not session infrastructure.

- `POST /auth/login` → validates `username + password` against `users` table
- Returns `{ id, username, displayName }` on success
- All protected endpoints require `X-User-Id` header
- API validates the header against the `users` table on every request
- Frontend stores user object in React state only (lost on page refresh — intentional for demo)
- Passwords stored as plaintext in DB — explicitly demo-only

---

## 6. Sync Flows

### 6.1 Add Item to List

```
Web → POST /items (X-User-Id) → API:
  → if new name: INSERT pantry_items (status=active)
  → if history item: UPDATE status=active (re-activation)
  → if already active: return existing item
→ UI refreshes
```

### 6.2 Mark Item as Bought

```
Web → POST /items/:id/bought (X-User-Id) → API:
  → UPDATE pantry_items SET status='history', last_bought_at=now
  → INSERT purchase_events
  → ensure shopping_session for today
  → enqueue REFILL_REMINDER job
→ UI refreshes
```

### 6.3 Remove from List

```
Web → POST /items/:id/remove (X-User-Id) → API:
  → UPDATE pantry_items SET status='history'
  → NO purchase event created
→ UI refreshes
```

Semantic distinction: "Bought" = purchased, "Remove" = no longer needed right now. Only "Bought" builds purchase history for cadence.

### 6.4 Re-add Known Item

```
Web → POST /items (X-User-Id, name matches known item) → API:
  → UPDATE pantry_items SET status='active' (same item ID)
→ UI refreshes (item moves from Known Items to Shopping List)
```

### 6.5 Suggestions

```
Web → GET /suggestions (X-User-Id) → API:
  → SELECT history items for user with last_bought_at
  → for each: calculate cadence from purchase_events
  → filter: due (days since ≥ cadence) or due soon (days since = cadence-1)
  → shopping session today → suppress "due soon" items
→ returns suggested items with urgency reason
```

---

## 7. Async Flows

### 7.1 Daily Digest

```
Scheduler (cron 8am) → getAllUsers() → for each user:
  → buildDailySummary (active count, known count, suggested count)
  → enqueue DAILY_DIGEST job
→ Queue → Notifications Worker:
  → record RECEIVED
  → process (simulate failure)
  → record SUCCESS or FAILED
```

### 7.2 Refill Reminders

```
Scheduler (cron 8am) → getAllUsers() → for each user:
  → find history items with cadence and last_bought_at
  → filter: days since ≥ cadence
  → skip items with successful reminder today (dedupe)
  → enqueue REFILL_REMINDER per item
→ Queue → Notifications Worker → record attempt
```

### 7.3 Bought Action Trigger

```
API (POST /items/:id/bought) → enqueue REFILL_REMINDER
→ Queue → Notifications Worker → record attempt
```

---

## 8. Reliability and Operations

### Retry Behavior

The notifications worker simulates 30% random transient failures. Failed messages are not acknowledged and are re-queued automatically by Cloudflare Queues.

### Drop Policy

Messages retried more than 3 times are acknowledged and recorded as `DROPPED`. This prevents infinite retry loops.

### Attempt Persistence

Every processing attempt is written to `notification_attempts` with:
- job type
- user ID
- item ID
- attempt number
- status: `RECEIVED | SUCCESS | FAILED | DROPPED`
- error message (if failed)
- full payload snapshot

### Reminder Dedupe

Before enqueueing a `REFILL_REMINDER`, the scheduler checks `notification_attempts` for a successful attempt for the same item on the same day. Duplicate reminders are skipped.

---

## 9. Why This Is Level 2

This project clearly demonstrates:

- service extraction (3 workers with distinct responsibilities)
- queue-based async processing with retry and drop policies
- scheduled orchestration across multiple users
- behavior-driven product logic (cadence from purchase history)
- status-based item lifecycle (no hard delete)
- user-scoped data with simple credential auth
- operational traceability (persisted attempt records)
- meaningful separation of sync vs async concerns
