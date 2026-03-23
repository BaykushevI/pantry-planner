# Deployment Notes

## 1. Purpose

This document describes how the system is deployed and structured in production.

---

## 2. Deployment Model

The system is deployed using:

- Cloudflare Pages (frontend)
- Cloudflare Workers (API and services)

---

## 3. Components

Each component is deployed separately:

- web → Pages
- api → Worker
- notifications → Worker
- scheduler → Worker

---

## 4. Environments

We consider three environments:

- local
- preview
- production

---

## 5. Database

- D1 is used as primary storage
- schema changes must be controlled
- migrations should be versioned

---

## 6. Notes

- deployment should remain simple
- avoid environment-specific logic inside code
- configuration should be explicit
