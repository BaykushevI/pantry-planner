# Architecture v1 — Pantry Planner

## 1. Overview

Pantry Planner is a Level 2 architecture project focused on evolving from a modular monolith to a service-based system with async processing.

The goal is to demonstrate:

- service extraction
- queue-based communication
- background processing
- scheduled jobs
- retry handling
- clean separation of concerns

---

## 2. System Components

The system consists of the following components:

- Frontend (React + Vite)
- Main API (Cloudflare Worker)
- Queue (Cloudflare Queues)
- Notification Service (Worker consumer)
- Scheduler (Cron-triggered Worker)
- Storage (D1)

---

## 3. Service Boundaries

### Main API

Responsible for:

- pantry items
- quantity tracking
- refill frequency
- suggestion rules
- user preferences
- synchronous request/response flows

Does NOT:

- send notifications
- handle retries
- run scheduled jobs

---

### Notification Service

Responsible for:

- processing async jobs
- sending reminders
- generating digests
- retry handling
- delivery logging

Does NOT:

- own pantry data
- expose user-facing APIs
- perform CRUD operations

---

### Scheduler

Responsible for:

- triggering daily jobs
- triggering weekly jobs
- enqueueing background tasks

---

## 4. Sync vs Async Model

### Sync flows

- add item
- update quantity
- fetch suggestions

### Async flows

- low stock alerts
- refill reminders
- daily digest
- weekly digest

---

## 5. Queue Usage

Queue is used for:

- decoupling API from background processing
- handling async work
- isolating failures

Queue is NOT used for:

- storing business data
- replacing database logic
- synchronous operations

---

## 6. Scheduler Role

Scheduler triggers:

- daily digest generation
- weekly shopping summary

It does NOT execute business logic directly — only enqueues jobs.

---

## 7. Storage Ownership

### Main API owns:

- pantry items
- user preferences
- suggestion logic

### Notification service owns:

- notification attempts
- delivery status
- retry state

---

## 8. Failure Model

- API must NEVER fail because of notification logic
- async jobs can fail independently
- retries are bounded
- failures are logged and observable
- system remains usable even when notifications fail

---

## 9. Non-Goals

This project intentionally avoids:

- AI-based recommendations
- complex microservice architecture
- multiple databases
- distributed transactions
- overengineering

---

## 10. Future Evolution (Preview)

- richer retry strategies
- better observability
- multiple notification channels
- improved suggestion engine
