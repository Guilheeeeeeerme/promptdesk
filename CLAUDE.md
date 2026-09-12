# CLAUDE.md — PromptDesk

Multi-tenant AI customer-support platform: admin SSO host, support-chat micro-frontend, and LLM orchestration with cost-ranked model failover.

Agent behavioral rules: see [AGENTS.md](./AGENTS.md). LLM policy reference (also used by Argus/Quizzeira): [docs/guardrails.md](./docs/guardrails.md).

## Live

| App | URL |
| --- | --- |
| Admin | https://app.promptdesk.ferredemo.dev |
| Support | https://support.promptdesk.ferredemo.dev |
| API | https://api.promptdesk.ferredemo.dev |

Production deploys are owned by the **infra** repo (Jenkins job `promptdesk`).

## Layout

Multi-app repo (no root `package.json` — each app has its own lockfile):

| Path | Role |
| --- | --- |
| `apps/api` | NestJS API, dual Prisma, Socket.IO, BullMQ producers |
| `apps/chat-worker` | BullMQ consumer → Gemini / OpenAI model ladder |
| `apps/web` | Vite admin + SSO host |
| `apps/support` | Vite support-chat MFE |
| `apps/shared/auth` | Shared auth helpers |
| `apps/shared/ui` | Shared UI pieces |

## Architecture

```
web (SSO) / support MFE
        │  Bearer opaque session
        ▼
     NestJS API ── Redis (sessions, BullMQ, pub/sub)
        ├── Postgres (users, companies, guidelines)
        └── Postgres-chat (conversations, messages, customers)
                 │ enqueue
                 ▼
            chat-worker → LLM → status → Socket.IO → browser
```

## Stack

- NestJS, Prisma, Socket.IO, BullMQ, React/Vite, Node 22 in CI
- Dual Postgres + Redis; Gemini primary, OpenAI failover
- Prompts live in `apps/chat-worker/prompts/registry.yml` (not inline in code)

## Local

```bash
cp .env.example .env
docker compose up --build
# or: scripts/up.sh
```

Typical ports: web `:8080`, support `:8081`, API `:3000`. Prod Redis uses DB `/0`.

## Commands

```bash
# API (apps/api)
npm ci
npm run prisma:generate
npm run prisma:migrate
npm test
npm run lint

# Worker (apps/chat-worker)
npm test

# Frontends (apps/web, apps/support)
# oxlint via each app's package scripts
```

Jenkins (via infra): `npm ci && npm run prisma:generate && npm test -- --passWithNoTests` in `apps/api`.

Seeds: `seed` / `seed:platform` / `seed:demo` under `apps/api`.

## Conventions

- Dual Prisma schemas: `apps/api/prisma/schema.prisma` and `apps/api/prisma-chat/schema.prisma` — keep DBs/roles separate.
- SSO return origins allow-listed via `SSO_RETURN_ORIGINS` (open-redirect safe).
- Model ladder: Redis-ranked (`MODEL_RANK_*`); honor `LLM_PROVIDER_ORDER`.
- Guardrails: deterministic screening before LLM; untrusted data only in fenced user-message context; never into system instructions; never log message/guideline bodies.
- Local Headroom: set provider base URLs from `.env.example`. Prod chat needs a real `GEMINI_API_KEY`.
