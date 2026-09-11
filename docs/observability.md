# Observability — structured logs for the infra Loki hub

Production scrapes container stdout via Grafana Alloy into Loki (24h retention).
See the infra Tree-of-Thoughts: `docs/love-logs-tot.md` in the `infra` repo
(branch `love-logs/observability-24h`), especially [Phase 5 — Selection](https://github.com/Guilheeeeeeerme/infra/blob/love-logs/observability-24h/docs/love-logs-tot.md#phase-5--selection).

## What changed here

- NestJS API and chat-worker boot with a JSON `LoggerService` (`apps/*/src/json-logger.ts`).
- Set `SERVICE_NAME` (Compose injects `promptdesk-<service>` in production).
- Guardrails unchanged: never log chat message or guideline bodies — ids/status only (`docs/guardrails.md`).

## Rollback

Revert this branch / drop the JsonLogger wiring; stdout becomes Nest’s default text logger. The infra hub still collects lines until Loki’s 24h TTL.
