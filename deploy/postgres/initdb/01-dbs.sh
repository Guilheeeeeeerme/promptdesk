#!/usr/bin/env bash
# Postgres initdb (first boot, empty volume) — PromptDesk databases.
# promptdesk      → owned by role `promptdesk`
# promptdesk_chat → owned by role `promptdesk_chat` (never merged)
# In Postgres 15+, the db owner owns the `public` schema by default
# (pg_database_owner), so the app roles can run `prisma migrate deploy`
# without extra grants.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<'SQL'
SELECT 'CREATE DATABASE promptdesk OWNER promptdesk'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'promptdesk')\gexec
SELECT 'CREATE DATABASE promptdesk_chat OWNER promptdesk_chat'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'promptdesk_chat')\gexec
SQL

echo '[initdb/01-dbs] databases promptdesk + promptdesk_chat ready'
