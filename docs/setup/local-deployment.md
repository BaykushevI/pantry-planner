# Local Development

## 1. Purpose

This document describes how development is performed on a daily basis.

---

## 2. Applications

The system consists of:

- web (frontend)
- api (main backend)
- notifications (background worker)
- scheduler (cron worker)

---

## 3. Development Workflow

Typical loop:

1. Choose a small task
2. Make a change
3. Validate locally
4. Commit
5. Push
6. Check CI

---

## 4. Development Rules

- Work in small increments
- Do not mix multiple concerns
- Keep changes reviewable
- Avoid large uncommitted changes

---

## 5. When to Start What

- API is needed for backend logic
- Web is used for UI
- Notifications and scheduler are not required in early steps

---

## 6. Validation Checklist

Before committing:

- project builds (if applicable)
- no broken structure
- changes are minimal and clear
