#!/usr/bin/env bash
# One-shot migration runner for PromptDesk's dual Prisma schemas.
# Runs in the `migrate` compose service (same image as the API). The API and
# chat-worker containers NEVER migrate on start — this is the only migration
# path in production. Honours SKIP_MIGRATIONS=1 (instant exit 0, rollback path).
set -euo pipefail

api_dir="${API_DIR:-/app}"

echo "[migrate] GIT_SHA=${GIT_SHA:-unknown} SKIP_MIGRATIONS=${SKIP_MIGRATIONS:-0}"

if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
  echo '[migrate] SKIP_MIGRATIONS=1 set — leaving schema untouched, exiting 0.'
  exit 0
fi

cd "$api_dir"

[ -f prisma/schema.prisma ] || { echo '[migrate] missing prisma/schema.prisma' >&2; exit 1; }
[ -f prisma-chat/schema.prisma ] || { echo '[migrate] missing prisma-chat/schema.prisma' >&2; exit 1; }

echo '[migrate] core schema (role promptdesk → db promptdesk):'
npx prisma migrate deploy --schema prisma/schema.prisma

echo '[migrate] chat schema (role promptdesk_chat → db promptdesk_chat):'
npx prisma migrate deploy --schema prisma-chat/schema.prisma

echo "[migrate] done for GIT_SHA=${GIT_SHA:-unknown}"
