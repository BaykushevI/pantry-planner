# Demo Checklist

## Goal

A step-by-step walkthrough for demonstrating Pantry Planner — what to run, what to show, and what to explain at each step.

---

## 1. Start the System

### API + Notifications (terminal 1)

```bash
cd apps/api

npx wrangler dev \
  -c wrangler.jsonc \
  -c ../notifications/wrangler.jsonc \
  --persist-to ../../.wrangler/state \
  --port 8787
```

### Frontend (terminal 2)

```bash
cd apps/web
pnpm dev
```

### Scheduler + Notifications (terminal 3 — when showing async flows)

```bash
cd apps/scheduler

npx wrangler dev \
  -c wrangler.jsonc \
  -c ../notifications/wrangler.jsonc \
  --persist-to ../../.wrangler/state \
  --port 8790 \
  --test-scheduled
```

> All three workers share the same `.wrangler/state` directory — this is how they share the D1 database locally.

---

## 2. Demo Flow

### A. Login

Open the app. Show the login screen.

- Explain: simple credential auth — username + password validated against the `users` table
- Login as `alice` / `alice123`
- Show that user identity is stored in React state only (no localStorage, no tokens)
- All subsequent API calls carry `X-User-Id: user_alice`

### B. Add items to the shopping list

Use the **Add to Shopping List** form:

- Type "Milk" — show the autocomplete dropdown (empty on first use)
- Add notes: "2 litres"
- Submit — item appears in **Current Shopping List**
- Add a few more items: "Eggs", "Bread", "Coffee"

Explain:
- Items start as `active` — they are on the current shopping list
- Notes replace quantity/unit — free text, user decides the format

### C. Mark items as bought

Click **Bought** on each item.

Explain what happens:
- Item status changes `active → history`
- A `purchase_event` is recorded with timestamp
- A shopping session is created for today
- Item disappears from Current Shopping List
- Item appears in **Known Items**
- A `REFILL_REMINDER` job is enqueued to the async pipeline

### D. Show Known Items

Point to the **Known Items** section.

Explain:
- These are items this user has previously added or bought
- They are available for quick re-adding
- History ≠ deleted — the item identity is preserved

Click **Add to list** on a Known Item — it reappears in Current Shopping List.

Explain:
- Same item ID reactivated — no duplicate created
- Notes from last use are preserved

### E. Show the identity/duplicate rule

Type the name of a Known Item in the Add form (e.g. "Milk").

- Autocomplete suggests it immediately
- Selecting it fills in the last-used notes
- Submitting re-activates the existing item rather than creating a new one

### F. Build purchase history for suggestions

For suggestions to appear, an item needs ≥ 2 purchase events with meaningful time gaps.

For a live demo, the easiest approach is to use `requests.http` to insert backdated purchase events directly:

```http
POST http://localhost:8787/items/ITEM_ID/bought
X-User-Id: user_alice
```

Run this multiple times (simulating purchases on different days) — or seed the DB directly.

Once cadence is established, items appear in **Suggested Items** with a "Due now" or "Due soon" badge and cadence metadata ("Every ~7d · last bought Mar 18 (9d ago)").

### G. Show Remove vs Bought

- **Remove** — takes item off the list without recording a purchase. Use this when you decided you don't need it after all.
- **Bought** — records the purchase, builds history, feeds the suggestion engine.

This distinction is key: only "Bought" makes the app smarter over time.

### H. Snooze a suggestion

Click **Snooze** on a suggested item.

Explain:
- Suppresses the item from suggestions for 1 day
- The item is still in Known Items
- It will reappear tomorrow

### I. Show user isolation

Sign out. Log in as `bob` / `bob123`.

Show that Bob has a completely empty list — his own isolated data.

Add a few items for Bob, buy them, show that Alice's suggestions are unaffected.

---

## 3. Show Async Behavior

With the Scheduler terminal running:

```http
GET http://localhost:8790/run-refill-reminders
GET http://localhost:8790/run-daily-digest
```

Explain:
- Scheduler iterates **all users** — no hardcoded user
- Builds per-user summaries and finds per-user refill-due items
- Enqueues `REFILL_REMINDER` and `DAILY_DIGEST` jobs to the queue
- Notifications Worker consumes them asynchronously

Show notification history:

```http
GET http://localhost:8787/notifications/history
```

Explain:
- Every attempt is persisted with status: `RECEIVED → SUCCESS / FAILED / DROPPED`
- 30% random failure rate simulates real-world transient failures
- Failed jobs are re-queued automatically by Cloudflare Queues
- After 3 retries: recorded as `DROPPED`
- Same-day deduplication: already-reminded items are skipped

---

## 4. Key Talking Points

- **Service extraction**: three workers with distinct responsibilities — API (sync domain), Scheduler (async producer), Notifications (async consumer)
- **No hard deletes**: item identity is preserved across status changes — the app learns from your history
- **Cadence from behavior**: suggestions are driven by real purchase events, not manual settings
- **Async decoupling**: marking something as bought does not block on the notification pipeline
- **User-scoped scheduler**: the cron job iterates all users — no hardcoded shortcuts
- **Operational visibility**: every async attempt is traceable, including failures and drops
