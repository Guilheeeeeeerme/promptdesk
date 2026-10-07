#!/usr/bin/env bash
# Postgres initdb (first boot, empty volume) — PromptDesk roles.
# Roles mirror PromptDesk's dual schema split; they MUST stay distinct
# (repo hard rule): `promptdesk` owns only the core DB, `promptdesk_chat`
# only the chat DB. No cross-grants.
set -euo pipefail

: "${POSTGRES_PROMPTDESK_PASSWORD:?POSTGRES_PROMPTDESK_PASSWORD is required}"
: "${POSTGRES_PROMPTDESK_CHAT_PASSWORD:?POSTGRES_PROMPTDESK_CHAT_PASSWORD is required}"

# Idempotent-ish: CREATE ROLE fails on re-run of initdb scripts only if the
# volume was wiped mid-way; guard with a catalog check.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'promptdesk') THEN
    CREATE ROLE promptdesk LOGIN PASSWORD '${POSTGRES_PROMPTDESK_PASSWORD}' NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'promptdesk_chat') THEN
    CREATE ROLE promptdesk_chat LOGIN PASSWORD '${POSTGRES_PROMPTDESK_CHAT_PASSWORD}' NOBYPASSRLS;
  END IF;
END
\$\$;
SQL

echo "[initdb/00-users] roles promptdesk + promptdesk_chat ready (kept distinct)"
