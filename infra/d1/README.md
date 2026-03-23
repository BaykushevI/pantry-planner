# D1 Infrastructure

This directory contains D1 database migration files for Pantry Planner.

## Rules

- schema changes must be versioned
- migrations are added incrementally
- existing applied migrations should not be edited
- application data schema is owned by the main API layer

## Migration Naming

Use incremental numeric prefixes, for example:

- 0001_initial_schema.sql
- 0002_add_user_preferences.sql
- 0003_add_indexes.sql
