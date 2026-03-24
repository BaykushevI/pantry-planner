# Pantry Planner

Pantry Planner is a Level 2 architecture portfolio project focused on evolving from a modular monolith mindset toward a service-based design with async processing, queue-based flows, scheduled jobs, retry handling, and early CI/CD discipline.

The project is intentionally kept lightweight, practical, and explainable. The goal is not to build a heavy enterprise platform, but to demonstrate clean architectural thinking, meaningful service extraction, and disciplined implementation.

## Project Context

This project is the second step in a 3-level architecture roadmap:

- **L1** — modular monolith
- **L2** — service extraction, async processing, queue-based background flows
- **L3** — distributed system + orchestration/advisor thinking

Pantry Planner is the **Level 2** project.

## Main Goal

Build a practical household pantry application that demonstrates:

- service extraction
- async processing
- queue-based architecture
- scheduled jobs
- retry logic
- CI/CD
- Docker basics for local convenience
- a more realistic operational model than L1

## Product Idea

Pantry Planner is a household pantry app for managing:

- pantry items
- quantity
- last bought date
- refill frequency
- rule-based suggestions
- reminders
- daily/weekly digest flows

The product remains intentionally simple:

- no heavy business logic
- no AI in v1
- no unnecessary microservice complexity
- no overengineering

## Architectural Direction

The system is designed around a clear separation between:

### Main App

Responsible for:

- pantry items
- quantity tracking
- refill frequency
- suggestion rules
- user preferences
- synchronous CRUD flows
- domain rule evaluation

### Background / Notification Service

Responsible for:

- low stock alerts
- reminder processing
- daily/weekly digest generation
- retry handling
- delivery logging
- scheduled background checks

### Queue

Used only where async decoupling has a real purpose:

- low stock notification requested
- refill due reminder requested
- daily digest requested
- weekly digest requested
- optional bounded retry jobs

### Storage

- main application data stored in D1
- queue is transient transport, not system-of-record storage
- notification attempt state is owned by the background processing side

## Technology Baseline

The current chosen stack is:

- **Frontend:** React + Vite + TypeScript
- **Main API:** Cloudflare Workers + TypeScript
- **Async processing:** Cloudflare Queues
- **Background consumer:** separate Worker
- **Scheduler:** cron-triggered Worker
- **Storage:** Cloudflare D1
- **CI/CD:** GitHub Actions
- **Local convenience:** Docker
- **Hosting:** Cloudflare Pages + Cloudflare Workers

## Repository Strategy

This project uses a **monorepo** structure.

Repository structure:

```text
apps/
  web/
  api/
  notifications/
  scheduler/

packages/
  shared/

docs/
  architecture/
  setup/
  deployment/
  roadmap/

infra/
  d1/
  docker/

.github/
  workflows/
```

## Implementation Principles

The project follows these rules from the start:
• keep it simple
• MVP first
• small safe increments
• docs-first
• early CI
• no giant hidden changes
• frequent commits
• frequent pushes
• short-lived branches
• architecture must remain explainable

## What This Project Should Demonstrate

By the end of L2, Pantry Planner should clearly show:
• why a separate background service exists
• how sync and async responsibilities differ
• how a queue decouples operational work
• how scheduled jobs fit into the system
• how retry handling is isolated from user-facing flows
• how CI/CD supports disciplined delivery
• how a simple app can still show strong system thinking

## Current Phase

Phase 1 — Foundation bootstrap

Current focus:
• repo foundation
• workspace structure
• docs-first setup
• shared package shell
• worker shells
• frontend shell
• CI bootstrap
• alignment pass

No feature logic is being implemented yet.

## Working Discipline

This repo is being built with a delivery mindset:
• one small reviewable step at a time
• validate locally after each step
• commit after each logical checkpoint
• push frequently
• keep the repo stable as often as possible
• do not mix setup work with feature work

## Status

Current status:

- initial repository foundation created
- root workspace configuration added
- documentation package added
- shared package shell created
- api shell created
- web shell created
- notifications shell created
- scheduler shell created
- initial CI workflow added and validated
- first queue-based notification flow implemented and validated locally

Next step:

- begin pantry core foundation

## Notes

This repository is intentionally being built in a way that makes the architecture easy to explain later in portfolio discussions, interviews, and future project evolution work.
