# Promptdesk

Multi-tenant AI customer-support platform: a main admin application (SSO host), a support-chat micro-frontend, and an LLM orchestration layer with cost-ranked model failover.

## Live

| Application | URL |
| --- | --- |
| Admin (SSO host) | https://app.promptdesk.ferredemo.dev |
| Support MFE | https://support.promptdesk.ferredemo.dev |
| API | https://api.promptdesk.ferredemo.dev |

## Features

- **SSO across origins** — opaque Redis-backed sessions; the support micro-frontend authenticates via hash-token handoff with `SSO_RETURN_ORIGINS` allow-listing against open redirects.
- **AI chat pipeline** — Gemini-first with per-provider cheapest-to-most-expensive model ranking (Redis-ranked ladders, refreshed periodically), automatic OpenAI failover, BullMQ retries, in-flight takeover, cancellation via abort flags, and manual retry on final failure.
- **Real-time status** — Socket.IO events scoped to the user's room; connections open only while jobs are pending or processing.
- **Company guidelines** — CRUD with upload/replace/clear, stored in Postgres, resolved into chat context.
- **Multi-tenancy** — platform roles (`root`/`admin`) with a company switcher; customer data isolated per company.
- **Internationalization** — UI and chat replies in the 10 most spoken languages.
- **Dual databases** — core data (users, companies, guidelines) and chat data (conversations, messages, customers) in separate Postgres instances with independent Prisma schemas.

## Architecture

```
Main app (Vite)       = SSO login host + admin shell + company switcher
Support MFE (Vite)    = support chat (Socket.IO only while jobs are live)
Chat worker           = BullMQ consumer → Gemini / OpenAI model ladder

Browser / MFE
    │  Authorization: Bearer <opaque-session-token>
    ▼
NestJS API
    ├── Redis          → sessions + BullMQ + pub/sub
    ├── Postgres       → users, companies, guidelines (Prisma)
    ├── Postgres-chat  → Conversation, ChatMessage, Customer (Prisma)
    └── enqueue generate job
         ▼
    chat-worker → LLM → publish status → API Socket.IO → browser
```

### Chat generate flow

1. `POST /chat` cancels in-flight assistant jobs for the user+company, persists the user message and a pending placeholder, then enqueues a BullMQ job (3 attempts by default).
2. The worker walks the provider's ranked model list, cheapest first; `GEMINI_API_KEY` is required, `OPENAI_API_KEY` enables failover.
3. Abort flags are checked before and after each LLM call; aborted jobs never write completed content.
4. On final failure the UI offers retry via `POST /chat/messages/:id/retry`.

## Guardrails & LLM spend

Promptdesk is the reference implementation of the guardrails standard consumed by Argus and Quizzeira. The full contract lives in [`docs/guardrails.md`](docs/guardrails.md).

| OWASP risk | Mitigation |
| --- | --- |
| LLM01 Prompt injection | Uploaded guidelines are screened against regex policies (`apps/chat-worker/src/guideline-validator.ts`); a hit marks the version `malicious` without an LLM call. All runtime data is JSON-stuffed into a delimited untrusted-context block in the user message (`apps/chat-worker/prompts/registry.yml`, `support.copilot.context`), never the system instruction. |
| LLM02 Sensitive disclosure | The system instruction (`registry.yml`, `support.copilot.system`) forbids treating context as instructions, revealing prompts/secrets, or exfiltrating data. |
| LLM10 Unbounded consumption | Redis fixed-window rate limits: chat sends `CHAT_RATE_LIMIT_PER_MINUTE` (default 20/min) and guideline uploads `GUIDELINE_UPLOAD_LIMIT` (default 10/min); prompt budgets cap context sizes; BullMQ retries are bounded. |

Provider and model selection:

- `LLM_PROVIDER_ORDER` (default `gemini,openai`) orders chat and guideline providers; unknown names are ignored and providers without a key are skipped. `GEMINI_API_KEY` is required, `OPENAI_API_KEY` enables failover.
- Cheapest-first model ladder (`apps/chat-worker/src/model-rank.service.ts`, Redis-cached, refreshed every `MODEL_RANK_REFRESH_MS`, default 12h = twice daily): attempt N walks `rank[N]`, cross-provider failover only after all attempts of the earlier provider fail.

## Tech stack

| Layer | Technology |
| --- | --- |
| API | NestJS, Prisma, Socket.IO, BullMQ |
| Databases | PostgreSQL ×2, Redis (sessions, queue, pub/sub) |
| LLMs | Google Gemini (primary), OpenAI (failover) |
| Frontends | React, Vite, shared auth package |

## Local development

This repository is development-oriented: `docker-compose.yml` runs a full local stack with dedicated dual Postgres and Redis for isolated DX. Production does not use this Compose file.

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
| --- | --- |
| Main app | http://localhost:8080 |
| Support MFE | http://localhost:8081 |
| API | http://localhost:3000 |

The dual-database split starts with an empty chat database; wipe volumes after pulling that change. Prisma schemas live at `apps/api/prisma/schema.prisma` (core) and `apps/api/prisma-chat/schema.prisma` (chat).

## Repository layout

```
apps/api          NestJS API — auth, companies, guidelines, chat, Socket.IO
apps/chat-worker  BullMQ consumer — LLM calls, model ranking, status events
apps/web          Main app — SSO host, admin shell, company switcher
apps/support      Support chat micro-frontend
apps/shared       Shared client helpers (token storage, apiFetch, SSO handoff)
```

## Deployment

Production images, shared data plane (Postgres/Redis), DNS, TLS, and rollout are owned by the private `infra` repository. This app only notifies infra on push to `main` (`.github/workflows/infra.yml`) when repository variable `INFRA_ENABLED=true` and secret `INFRA_DISPATCH_TOKEN` are set. Infra builds reproducible release bundles (application SHA + infrastructure SHA) and rolls them out with health-checked Compose deployments. Redis DB index `/0` is used in production on the shared Redis; local Compose keeps its own Redis.
