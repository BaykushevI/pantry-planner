# Deployment Notes

## 1. Current Posture

Pantry Planner is currently optimized for local development and architecture demonstration.

The target deployment posture is:

- Cloudflare Pages for the web frontend
- Cloudflare Workers for API, Scheduler, and Notifications
- Cloudflare D1 for durable storage
- Cloudflare Queues for background job transport

---

## 2. Current Focus

The focus of this project is:

- clean architecture with meaningful service boundaries
- async processing and queue-based decoupling
- user-scoped data model with multi-user isolation
- explainable business logic (cadence-driven suggestions)
- operational visibility through persisted notification attempts

---

## 3. What Is Implemented

The following is fully implemented and functional:

- **Simple credential auth** — `POST /auth/login` validates username/password against the `users` table
- **Multi-user data isolation** — all items, purchase events, shopping sessions, and suggestions are user-scoped
- **Item status lifecycle** — active/history model, no hard deletes
- **Purchase-history-based cadence** — suggestions derived from real purchase events
- **Async pipeline** — scheduler → queue → notifications worker with retry and attempt persistence
- **Per-user scheduled jobs** — scheduler iterates all users, no hardcoded user IDs

---

## 4. What Is Intentionally Simplified

The following are intentionally simplified for a demo/portfolio context:

- **Passwords stored as plaintext** — production would use bcrypt or similar hashing
- **No token-based auth** — user identity passed as `X-User-Id` header; production would use signed tokens or sessions
- **No email verification or password recovery**
- **No real notification delivery** — notifications worker logs and records attempts but does not send emails/push
- **No production secrets management**

These are known trade-offs, not oversights. The project demonstrates architectural patterns, not production-hardened auth infrastructure.

---

## 5. D1 Deployment Note

Local development uses a shared `.wrangler/state` persist path. Production requires a real Cloudflare D1 instance with a valid `database_id` in each worker's `wrangler.jsonc`.

Migrations in `infra/d1/migrations/` must be applied in order against the production D1 instance.

---

## 6. Queue Deployment Note

In production, queue producers (API, Scheduler) and consumers (Notifications Worker) are deployed as separate Cloudflare Workers with proper queue bindings and environment configuration.

---

## 7. CI/CD Note

Current CI validates workspace integrity and TypeScript types.

A production deployment pipeline would additionally include:

- D1 migration execution as part of the deploy step
- preview deployments per branch
- staged promotion (staging → production)
- environment-specific wrangler configurations
