# Local Setup

## 1. Purpose

This document describes how to prepare a local development environment for Pantry Planner.

---

## 2. Required Tools

You should have the following installed:

- Node.js 22(LTS)
- pnpm
- Git
- Cloudflare Wrangler
- Docker (optional, for convenience)

---

## 3. Repository Setup

Steps:

1. Clone the repository:
   ```
   git clone <repo-url>
   cd pantry-planner
   ```
2. Install dependencies (workspace-level):
   ```
   pnpm install
   ```
3. Verify project structure — all apps and packages should resolve with no errors.

---

## 4. What "Ready" Means

A working local setup means:

- repository installs successfully
- workspace resolves correctly
- all apps are recognized
- no configuration errors

---

## 5. Notes

- Docker is optional and used only for convenience
- Cloudflare services are not required locally at this stage
