# Future Improvements

## 1. Product Evolution

Natural next steps for the shopping memory experience:

- **Notes history per item** — remember previous notes variations (e.g. "2 litres" vs "1 litre") and let the user pick
- **Shopping list sharing** — shared list between two users in the same household
- **Bought quantity as a signal** — if the user always buys 2 of something, surface that as a default note suggestion
- **Better suggestion explanations** — show "you usually buy this every 7 days, last bought 8 days ago" in the UI
- **Purchase history view** — per-item timeline of when it was bought
- **Mobile-first UI** — current layout works on desktop; optimise for one-handed mobile use

---

## 2. Suggestion Engine Evolution

The cadence engine currently uses average days between consecutive purchases. Future directions:

- **Cadence confidence scoring** — require a minimum number of events before surfacing a suggestion (currently: 2)
- **Recency weighting** — weight recent purchases more than older ones when calculating average cadence
- **Occasional-item filtering** — detect items bought only once or twice a year and handle differently
- **Adaptive cadence** — adjust based on deviation (e.g. if the user always buys every 6-8 days, treat 6 as the lower bound)

---

## 3. Auth Evolution

The current auth model is intentionally simple (plaintext passwords, X-User-Id header). A production-ready evolution would include:

- Password hashing (bcrypt or Argon2)
- Signed session tokens or JWT
- Token refresh and expiry
- User registration flow
- Password recovery

---

## 4. Operational Evolution

- **Longer-window reminder dedupe** — currently dedupes within same day; could extend to N hours
- **Dead-letter queue handling** — route dropped messages to a separate DLQ for manual inspection
- **Structured logs with correlation IDs** — trace a job from scheduler through queue to notifications worker
- **Alerting on repeated failures** — detect when a job type has high failure rate
- **Notification delivery** — replace the current log-and-record simulation with actual push or email delivery

---

## 5. L3-Oriented Evolution

Potential Level 3 directions from this foundation:

- **Orchestration layer** — coordinate multi-step workflows (e.g. re-check item after snooze, escalate if not bought)
- **Advisor-style explanation system** — the app explains its suggestions in natural language
- **Policy / rule introspection** — expose why a suggestion was or was not surfaced
- **More distributed service boundaries** — split suggestion engine into its own service
- **Event sourcing** — build state from purchase events rather than maintaining mutable item records
