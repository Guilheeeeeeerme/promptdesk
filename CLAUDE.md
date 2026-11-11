# CLAUDE.md — PromptDesk

Multi-tenant AI customer-support platform: admin SSO host, support-chat micro-frontend, Gemini chat generation, and JEV guideline decisions.

Agent behavioral rules: see [AGENTS.md](./AGENTS.md). LLM policy reference (also used by Argus/Quizzeira): [docs/guardrails.md](./docs/guardrails.md).

## Live

| App | URL |
| --- | --- |
| Admin | https://app.promptdesk.ferredemo.dev |
| Support | https://support.promptdesk.ferredemo.dev |
| API | https://api.promptdesk.ferredemo.dev |

Production backend deploys use this repo's `Deploy` workflow → GHCR → existing Dokploy Compose stack. The production Postgres container holds separate core/chat databases and roles (`promptdesk` / `promptdesk_chat`); keep them distinct. Frontends use Cloudflare Pages through this repo's `Pages` workflow. Infra owns VPS operations. Local Compose uses its own Docker Postgres pair. PromptDesk never uses Supabase. Step-by-step: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Layout

Multi-app repo (no root `package.json` — each app has its own lockfile):

| Path | Role |
| --- | --- |
| `apps/api` | NestJS API, dual Prisma, Socket.IO, BullMQ producers |
| `apps/chat-worker` | BullMQ consumer → Gemini generation + JEV guideline decisions |
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
- Separate core/chat Postgres databases + Redis; Gemini-only generation, JEV guideline decisions
- Prompts live in `apps/chat-worker/prompts/registry.yml` (not inline in code)

## Local

```bash
cp .env.example .env.local.docker   # dual Compose Postgres (core + chat) + hot reload
cp .env.local.docker .env
docker compose up --build
# or: scripts/up.sh
```

**DB:** local = Compose pair (`.env.local.docker`); prod = existing Dokploy Postgres container with separate databases/roles. No remote tunnel. Typical ports: web `:8080`, support `:8081`, API `:3000`. Prod Redis uses DB `/0`.

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

CI pre-deploy (`.github/workflows/deploy.yml`): install and run tests for API and worker, then build both images and smoke-test dual-schema migrations and `/version` before the Dokploy webhook.

Seeds: `seed` / `seed:platform` / `seed:demo` under `apps/api`.

## Conventions

- Dual Prisma schemas: `apps/api/prisma/schema.prisma` and `apps/api/prisma-chat/schema.prisma` — keep DBs/roles separate.
- SSO return origins allow-listed via `SSO_RETURN_ORIGINS` (open-redirect safe).
- Chat generation is Gemini. Guideline checks are JEV when `JEV_GUIDELINE_MODE=active`.
- Guardrails: deterministic screening before LLM; untrusted data only in fenced user-message context; never into system instructions; never log message/guideline bodies.
- Gemini is called directly. Set provider base URLs from `.env.example`. Prod chat needs a real `GEMINI_API_KEY`.
