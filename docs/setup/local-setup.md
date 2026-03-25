# Local Setup

## 1. Purpose

This document describes the minimum local setup required to run Pantry Planner in development mode.

---

## 2. Requirements

- Node.js 22
- pnpm
- Wrangler CLI (`npm install -g wrangler`)
- VS Code
- REST Client extension for VS Code (for `requests.http` files)

---

## 3. Install Dependencies

From the repository root:

```bash
pnpm install
```

---

## 4. Project Structure

The project is a pnpm monorepo:

```
apps/web           React frontend (Vite + TypeScript)
apps/api           Main API Worker (Cloudflare Workers)
apps/notifications Notifications Worker (queue consumer)
apps/scheduler     Scheduler Worker (cron producer)
packages/shared    Shared types and contracts
infra/d1/          Database migrations
```

---

## 5. Apply Migrations

All workers share a single local D1 database. Migrations must be applied before first run and after any schema changes.

Run from the repo root:

```bash
npx wrangler d1 execute pantry-planner-db --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0001_initial_schema.sql

npx wrangler d1 execute pantry-planner-db --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0002_add_snooze.sql

npx wrangler d1 execute pantry-planner-db --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0003_add_purchase_events.sql

npx wrangler d1 execute pantry-planner-db --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0004_add_shopping_sessions.sql

npx wrangler d1 execute pantry-planner-db --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0005_add_notification_attempts.sql

npx wrangler d1 execute pantry-planner-db --local \
  --persist-to .wrangler/state \
  --file infra/d1/migrations/0006_users_and_model_update.sql
```

Migration `0006` creates the `users` table and seeds two demo accounts:

| Username | Password |
|----------|----------|
| `alice`  | `alice123` |
| `bob`    | `bob123` |

---

## 6. Shared Local State Rule

When using D1 and Queues locally, all workers must use the same persist path:

```
--persist-to ../../.wrangler/state
```

Without this, each worker operates against a separate isolated database. All workers in this project are pre-configured to use this shared path.

---

## 7. Recommended Tools

- VS Code
- REST Client extension (for `.http` files)
- Multiple terminal tabs (API + Scheduler + Frontend run separately)
- Git
