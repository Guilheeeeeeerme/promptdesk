# AI Support Assistant

Full-stack platform for AI-assisted customer support with a **main SSO host** and **micro-frontends** that share Redis-backed opaque sessions.

## Phases

**Phase 1 (done):** Auth, Redis sessions, company switcher (platform roles), seed data, main shell.

**Phase 2 (done):** Support chat MFE with SSO redirect, chat API + ephemeral Socket.IO status.

**Phase 3 (done):** Company + guideline CRUD (Postgres text storage, upload/replace/clear, Companies UI).

**Phase 4 (done):** Gemini replies via BullMQ + `chat-worker` microservice (3 auto-retries, manual retry).

**Later:** History MFE, etc.

## Architecture

```
Main app (:8080)     = SSO login host + admin shell + company switcher (root/admin)
Support MFE (:8081)  = support chat (ephemeral WS for pending jobs)
Chat worker (:3001)  = BullMQ consumer → Gemini / OpenAI failover

Browser / MFE
    │  Authorization: Bearer <opaque-session-token>
    ▼
NestJS API (:3000, dmz_internal)
    ├── Redis          → sessions + BullMQ + pub/sub
    ├── postgres       → users, companies, guidelines (DATABASE_URL)
    ├── postgres-chat  → Conversation, ChatMessage, Customer (CHAT_DATABASE_URL)
    └── enqueue generate job
         ▼
    chat-worker (dmz_internal) → LLM → publish status → API Socket.IO
```

All Compose services join the `dmz_internal` Docker network for service-to-service DNS
(`api` ↔ `chat-worker` ↔ `redis` ↔ `postgres` / `postgres-chat`). Edge ports stay published
for the host/browser; prefer S2S traffic on that network rather than `localhost` inside containers.

**Local/dev data:** dual-DB is a **fresh split** — wipe volumes (`docker compose down -v`) after
pulling this change. Core seed still runs; chat DB starts empty (no chat seed).

Prisma schemas:
- Core: [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma) → `DATABASE_URL`
- Chat: [`apps/api/prisma-chat/schema.prisma`](apps/api/prisma-chat/schema.prisma) → `CHAT_DATABASE_URL`

Shared client helpers live in [`apps/shared/auth`](apps/shared/auth) (token storage, `apiFetch`, SSO redirect URL builders, `consumeTokenFromUrl`).

### Chat generate flow

1. `POST /chat` cancels any in-flight assistant jobs for that user+company (takeover), persists the **user** message and a **pending** assistant placeholder, then enqueues a BullMQ job (default **3** attempts).
2. Support MFE opens Socket.IO **only while** jobs are pending/processing; joins room via session user id.
3. Worker always prefers **Gemini** and tries each provider's ranked models from cheapest to most expensive. BullMQ attempts walk Redis `models:rank:gemini` (cheapest top-3, refreshed at startup and every `MODEL_RANK_REFRESH_MS`, default 12 hours). `GEMINI_API_KEY` is required. Abort flag `chat:abort:{assistantMessageId}` is checked before/after the LLM call; aborted jobs never write completed content.
4. If all Gemini attempts fail **and** `OPENAI_API_KEY` is set, worker re-enqueues `provider=openai` and walks `models:rank:openai`. Without OpenAI key, job fails. Next message starts on Gemini again.
5. Worker publishes `chat:events`; API emits `job:update` to the user room (`completed` | `failed` | `cancelled` | `processing`).
6. **Stop** → `POST /chat/messages/:id/stop` marks `cancelled`, sets abort flag, removes queued BullMQ jobs.
7. On final failure, UI shows **Retry** → `POST /chat/messages/:id/retry` (fresh Gemini attempts).
8. Socket disconnects when no local pending jobs remain.

### SSO flow (different origins cannot share localStorage)

1. MFE opens without a fresh `#token=` → redirect to  
   `http://localhost:8080/sso/handoff?returnUrl=<encoded MFE URL>`
2. If the main app already has a session → redirect to `returnUrl#token=<opaque>`
3. Otherwise → `/login?returnUrl=…`, then the same hash handoff
4. MFE stores that token (overwriting any stale per-origin token), strips the hash, calls `GET /auth/me`

The **Chat** link on the main app also appends `#token=` so Support immediately uses the same Redis session Main just updated.

`SSO_RETURN_ORIGINS` / `VITE_SSO_RETURN_ORIGINS` prevent open redirects.

### Roles

| Role | Scope | Can change `activeCompanyId`? |
|------|--------|-------------------------------|
| `root` | Platform | Yes (`PATCH /auth/context`) — **main app only** |
| `admin` | Platform | Yes — **main app only** |
| `manager` | One company | No |
| `agent` | One company | No |

Support MFE never shows a company switcher. Platform users switch tenant on the main app; Support reads the updated session on refresh / next request.

**Security rule:** tenant APIs must use Redis `activeCompanyId` only — never trust a client `companyId`.

## Quick start

1. Copy [`.env.example`](.env.example) → `.env` and set `GEMINI_API_KEY` (required for the worker).
2. Start:

```bash
./scripts/up.sh -d
```

Or:

```bash
cd apps/api && npm install && npx prisma generate && npx prisma generate --schema prisma-chat/schema.prisma && npm run build
cd ../chat-worker && npm install && npx prisma generate --schema ../api/prisma/schema.prisma && npx prisma generate --schema ../api/prisma-chat/schema.prisma && npm run build
cd ../web && npm install && VITE_API_URL=/api VITE_SUPPORT_ORIGIN=http://localhost:8081 npm run build
cd ../support && npm install && VITE_API_URL=/api VITE_MAIN_ORIGIN=http://localhost:8080 npm run build
cd ../.. && docker compose up --build -d
```

| Service | URL |
|---------|-----|
| Main app (SSO) | http://localhost:8080 |
| Support MFE | http://localhost:8081 |
| API | http://localhost:3000 |
| Chat worker health | http://localhost:3001/health |
| Postgres (core) | `localhost:5432` |
| Postgres (chat) | `localhost:5433` |
| Redis | `localhost:6379` |

## Seed credentials

Password for all seeded users: **`Password123!`**

| Email | Role | Company |
|-------|------|---------|
| `root@example.com` | root | — |
| `admin@example.com` | admin | — |
| `manager.bookshop@example.com` | manager | Bookshop |
| `agent.bookshop@example.com` | agent | Bookshop |
| `manager.vpn@example.com` | manager | VPN SaaS |
| `agent.vpn@example.com` | agent | VPN SaaS |

## Auth API

```http
Authorization: Bearer <session-token>
```

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/auth/login` | Returns `{ token, user, activeCompany }` |
| `POST` | `/auth/logout` | Deletes Redis session |
| `GET` | `/auth/me` | Session bootstrap for every MFE |
| `PATCH` | `/auth/context` | `{ companyId }` — root/admin only |
| `GET` | `/companies` | List companies |

## Companies + guidelines API

All routes require `Authorization: Bearer <session-token>`.

Tenant access: platform (`root` / `admin`) can reach every company. `manager` / `agent` only their Redis `activeCompanyId`. Writes (create company, upload/clear guidelines) require platform or `manager` (agents are read-only).

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/companies` | List companies with guideline meta + message counts |
| `GET` | `/companies/:id` | Detail including full `guidelineText` |
| `POST` | `/companies` | Multipart: `name` (+ optional `file` `.txt`) — platform only |
| `PUT` | `/companies/:id/guidelines` | Multipart field `file` (`.txt`, ≤10MB) — replace |
| `DELETE` | `/companies/:id/guidelines` | Clear stored guidelines |

Guidelines live in Postgres on `Company` (`guidelineText`, `guidelineFileName`, `guidelineUpdatedAt`).

## Chat API

All routes require `Authorization: Bearer <session-token>`. Resources are scoped to the Redis session (`activeCompanyId` + `userId`); foreign company/user/deleted ids return **404**.

### Conversations

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/chat/conversations` | List (`?status=&pinned=&archived=&q=&limit=50&offset=0`), newest activity first |
| `POST` | `/chat/conversations` | Create (`{ title? }`); binds the company guideline snapshot immediately |
| `GET` | `/chat/conversations/:id` | Detail |
| `GET` | `/chat/conversations/:id/messages` | Full transcript (oldest first) |
| `PATCH` | `/chat/conversations/:id` | `{ pinned?, archived?, status?, title?, rating? }` |
| `DELETE` | `/chat/conversations/:id` | **Soft** delete (`deletedAt` set); excluded from lists, detail → 404 |

Lifecycle rules:

- `status` enum: `open` | `in_progress` | `solved` | `not_solved`.
- `solved` / `not_solved` are **final**: the conversation becomes a view-only transcript — `POST /chat` and message retry are rejected with **409**. Reopen explicitly via `PATCH { "status": "open" }` (or `in_progress`).
- `PATCH` stays available in final status (that is how reopen works). `rating` is stars `1..5` (`null` clears it); `title` caps at 200 chars.

**Sticky guidance:** the guideline snapshot is bound once at conversation start (`guidelineSnapshot` + sha256 `guidelineSnapshotHash`; `guidelineVersionId` carries the same sha256 token as the `GuidelineVersion.contentHash` scheme). The worker generates replies from the snapshot only — replacing or clearing the company guideline never changes in-flight conversations.

### Messaging

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/chat` | Body `{ message, conversationId? }`; without `conversationId` a fresh conversation (with binding) is created automatically. Persists user + pending assistant stamped onto the conversation and enqueues the BullMQ job |
| `GET` | `/chat/messages` | Legacy global history for session user + active company (`?limit=50`) |
| `POST` | `/chat/messages/:id/retry` | Re-enqueue a **failed** assistant message (409 while its conversation is final) |
| `POST` | `/chat/messages/:id/stop` | Cancel a pending/processing assistant message |
| Socket.IO | `/socket.io` | Auth via `auth.token` or `query.token`; emits `ready` / `job:update` |

### Chat reliability

- **Fair-use limit:** `POST /chat` and `POST /chat/messages/:id/retry` (both trigger LLM work) are capped per user + active company with a fixed 1-minute window: `CHAT_RATE_LIMIT_PER_MINUTE` (default `20`). Exceeding it returns **429** with a friendly message; the window resets after the minute.
- **Idempotent sends:** `POST /chat` accepts an optional `idempotencyKey` (body, max 64 chars) or `Idempotency-Key` header (body wins). Replaying the same key within **24h** returns the original stored response — no duplicate messages, no extra LLM job. A key that is still processing returns **409** ("Already sending this message"). No key → behavior unchanged. Keys are scoped to the signed-in user + active company, so they can never be replayed across users or companies.

### Backfill legacy messages

Groups pre-conversation `ChatMessage` rows (`conversationId` null) into one "Imported chat" conversation per (companyId, userId), with no guideline binding. Idempotent — safe to re-run; not wired into migrations:

```bash
cd apps/api && npm run backfill:conversations
```

Env (see `.env.example`): `DATABASE_URL` (core), `CHAT_DATABASE_URL` (chat), **required** `GEMINI_API_KEY`, optional `OPENAI_API_KEY` (failover only), `CHAT_JOB_ATTEMPTS` (default `3`), `CHAT_RATE_LIMIT_PER_MINUTE` (default `20`), `MODEL_RANK_REFRESH_MS` (default `43200000`, 12 hours; also refreshed at worker startup). Redis keys: `models:rank:gemini`, `models:rank:openai`, `models:rank:updatedAt`, `chat:idem:{companyId}:{userId}:{key}`.

## Manual test plan

### Chat + Gemini

1. Set `GEMINI_API_KEY` in `.env`, restart `api` + `chat-worker`
2. Sign in as `agent.bookshop@example.com` on Support (`:8081`)
3. Send a message → pending bubble → assistant reply arrives over Socket.IO
4. (Optional) stop worker / use bad key → after 3 attempts UI shows failure + **Retry**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"agent.bookshop@example.com","password":"Password123!"}' | jq -r .token)

curl -s -X POST http://localhost:3000/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"Order delayed"}' | jq
```

### Companies + guidelines

1. Sign in as `admin@example.com` → **Companies**
2. Open Bookshop → View shows seeded guidelines
3. Replace with a `.txt` file → meta + timestamp update
4. Add Company with optional guidelines file
5. As `agent.bookshop@example.com` → can View, cannot upload/clear
6. As `manager.bookshop@example.com` → can replace guidelines for Bookshop only

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Password123!"}' | jq -r .token)

COMPANY_ID=$(curl -s http://localhost:3000/companies \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

curl -s -X PUT "http://localhost:3000/companies/$COMPANY_ID/guidelines" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@bookshop_support_guidelines.txt" | jq
```

### Auth (main)

1. Open http://localhost:8080 → `admin@example.com` / `Password123!`
2. Switch company; token unchanged

### SSO + Support MFE

1. Open http://localhost:8081 (logged out) → redirect to main login with `returnUrl`
2. Sign in as `agent.bookshop@example.com` → back to Support with Bookshop (read-only, **no** switcher)
3. Send a message → pending → Gemini reply (worker must be up)
4. As admin: switch company on `:8080`, refresh Support → `/auth/me` shows new company
5. Evil `returnUrl=https://evil.example` on login is rejected

## Repo layout

```
apps/api          NestJS + Prisma (core + chat clients) + Redis sessions + BullMQ producer + Socket.IO
apps/chat-worker  BullMQ consumer → Gemini / OpenAI (chat DB + core reads)
apps/web          Main app / SSO host + Companies UI
apps/support      Support chat MFE
apps/shared/auth  Shared token + SSO helpers
docker-compose.yml  postgres + postgres-chat + redis + api + chat-worker + web + support (dmz_internal)
scripts/up.sh
```

## Adding another MFE

1. New Vite app (e.g. `:8082`)
2. Reuse `@shared/auth`: `consumeTokenFromUrl` → else `redirectToLogin(MAIN_ORIGIN)`
3. Bootstrap with `getSession(apiBase)`
4. Add origin to `SSO_RETURN_ORIGINS` and `CORS_ORIGIN`
5. Add Compose service + build step in `scripts/up.sh`

## Production

Production builds, domains and Hostinger deployment are managed in the private [infra repository](https://github.com/Guilheeeeeeerme/infra). This repository retains local development configuration only. Its GitHub workflow notifies infra when deployment is enabled.
