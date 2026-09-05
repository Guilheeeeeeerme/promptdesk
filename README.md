# AI Support Assistant

Full-stack platform for AI-assisted customer support with a **main SSO host** and **micro-frontends** that share Redis-backed opaque sessions.

## Phases

**Phase 1 (done):** Auth, Redis sessions, company switcher (platform roles), seed data, main shell.

**Phase 2 (done):** Support chat MFE with SSO redirect, chat stub API + WebSocket ack (no AI replies yet).

**Later:** Gemini replies, guideline uploads, History MFE, etc.

## Architecture

```
Main app (:8080)     = SSO login host + admin shell + company switcher (root/admin)
Support MFE (:8081)  = chat skeleton (this phase)
Future MFEs (:8082+) = same redirect SSO + GET /auth/me bootstrap

Browser / MFE
    │  Authorization: Bearer <opaque-session-token>
    ▼
NestJS API
    ├── Redis  → session:{token} { userId, role, activeCompanyId, ... }
    └── Postgres → users, companies, chat messages
```

Shared client helpers live in [`apps/shared/auth`](apps/shared/auth) (token storage, `apiFetch`, SSO redirect URL builders, `consumeTokenFromUrl`).

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

```bash
./scripts/up.sh -d
```

Or:

```bash
cd apps/api && npm install && npx prisma generate && npm run build
cd ../web && npm install && VITE_API_URL=/api VITE_SUPPORT_ORIGIN=http://localhost:8081 npm run build
cd ../support && npm install && VITE_API_URL=/api VITE_MAIN_ORIGIN=http://localhost:8080 npm run build
cd ../.. && docker compose up --build -d
```

| Service | URL |
|---------|-----|
| Main app (SSO) | http://localhost:8080 |
| Support MFE | http://localhost:8081 |
| API | http://localhost:3000 |
| Postgres | `localhost:5432` |
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

## Chat API (skeleton — no AI yet)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/chat` | Body `{ message }`; tenant from Redis; persists **user** message; `reply: null` |
| Socket.IO | `/socket.io` | Auth via `auth.token` or `query.token`; emits `ready` / `ack` only |

## Manual test plan

### Auth (main)

1. Open http://localhost:8080 → `admin@example.com` / `Password123!`
2. Switch company; token unchanged

### SSO + Support MFE

1. Open http://localhost:8081 (logged out) → redirect to main login with `returnUrl`
2. Sign in as `agent.bookshop@example.com` → back to Support with Bookshop (read-only, **no** switcher)
3. Send a message → user bubble + “accepted” system note; no AI reply
4. As admin: switch company on `:8080`, refresh Support → `/auth/me` shows new company
5. Evil `returnUrl=https://evil.example` on login is rejected

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"agent.bookshop@example.com","password":"Password123!"}' | jq -r .token)

curl -s -X POST http://localhost:3000/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"message":"Order delayed"}' | jq
```

## Repo layout

```
apps/api        NestJS + Prisma + Redis + chat stub
apps/web        Main app / SSO host
apps/support    Support chat MFE
apps/shared/auth  Shared token + SSO helpers
docker-compose.yml
scripts/up.sh
```

## Adding another MFE

1. New Vite app (e.g. `:8082`)
2. Reuse `@shared/auth`: `consumeTokenFromUrl` → else `redirectToLogin(MAIN_ORIGIN)`
3. Bootstrap with `getSession(apiBase)`
4. Add origin to `SSO_RETURN_ORIGINS` and `CORS_ORIGIN`
5. Add Compose service + build step in `scripts/up.sh`
