# AI Support Assistant

Full-stack platform for AI-assisted customer support. **Phase 1** delivers token-based authentication with **Redis-backed shared tenant sessions**. Chat, guideline uploads, and AI integration come in later phases.

## Phase 1 scope

**Included**

- NestJS API + Prisma + PostgreSQL
- Opaque session tokens stored in Redis (`session:{token}`)
- Shared `activeCompanyId` on the session (same token across apps/MFEs)
- React/Vite web UI (Tailwind, matching the provided HTML boilerplate look)
- Login / logout / session / company context switch
- Seeded companies and users
- `docker compose up` bring-up

**Not included yet**

- Guideline `.txt` upload or seeding into the DB (files remain in the repo for later)
- Support chat, history, Gemini/AI
- User registration
- Real-time MFE tenant sync (BroadcastChannel / SSE / WebSocket)

## Architecture

```
Browser (React)
    │  Authorization: Bearer <opaque-session-token>
    ▼
NestJS API
    ├── Redis  → session:{token} { userId, role, activeCompanyId, createdAt, expiresAt }
    └── Postgres → users, companies, roles (source of truth for identity & assignments)
```

### Roles

| Role | Scope | Can change `activeCompanyId`? |
|------|--------|-------------------------------|
| `root` | Platform | Yes (`PATCH /auth/context`) |
| `admin` | Platform | Yes |
| `manager` | One company | No — fixed at login |
| `agent` | One company | No — fixed at login |

Platform users (`root` / `admin`) get the first company as `activeCompanyId` on login. Changing company updates Redis only; the Bearer token does **not** change.

**Security rule for later APIs:** never trust a client-supplied `companyId` as the tenant. Resolve tenant from the Redis session’s `activeCompanyId`.

## Quick start

From a clean checkout, build the apps on the host (required once / after dependency changes), then start Compose:

```bash
./scripts/up.sh -d
```

Or step by step:

```bash
cd apps/api && npm install && npx prisma generate && npm run build
cd ../web && npm install && npm run build
cd ../.. && docker compose up --build -d
```

`docker compose up --build` expects `apps/api/dist` + `apps/api/node_modules` and `apps/web/dist` to already exist (Compose bind-mounts the API and packages the web `dist` into nginx). This avoids flaky `npm install` inside Docker builds.

| Service | URL |
|---------|-----|
| Web UI | http://localhost:8080 |
| API | http://localhost:3000 |
| Postgres | `localhost:5432` (user/pass/db: `support`) |
| Redis | `localhost:6379` |

Copy [`.env.example`](.env.example) if you run the API outside Compose.

### Local development (optional)

```bash
# infra
docker compose up postgres redis -d

# API
cd apps/api
cp ../../.env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev

# Web (proxies /api → :3000)
cd apps/web
npm install
npm run dev
```

Web: http://localhost:5173

## Seed credentials

Password for all seeded users: **`Password123!`**

| Email | Role | Company |
|-------|------|---------|
| `root@example.com` | root | — (platform) |
| `admin@example.com` | admin | — (platform) |
| `manager.bookshop@example.com` | manager | Bookshop |
| `agent.bookshop@example.com` | agent | Bookshop |
| `manager.vpn@example.com` | manager | VPN SaaS |
| `agent.vpn@example.com` | agent | VPN SaaS |

Seeded companies: **Bookshop**, **VPN SaaS** (names only; guideline files not ingested yet).

## Auth API

All authenticated routes require:

```http
Authorization: Bearer <session-token>
```

### `POST /auth/login`

```json
{ "email": "admin@example.com", "password": "Password123!" }
```

Response:

```json
{
  "token": "<opaque-session-id>",
  "user": { "id": "...", "email": "...", "name": "...", "role": "admin" },
  "activeCompany": { "id": "...", "name": "Bookshop" }
}
```

### `POST /auth/logout`

Deletes the Redis session. Requires Bearer token.

### `GET /auth/me`

Returns current server-side session context (no new token):

```json
{
  "user": { "id": "...", "email": "...", "name": "...", "role": "admin" },
  "activeCompany": { "id": "...", "name": "Bookshop" }
}
```

Use this when bootstrapping any MFE. After refresh, always recover tenant from the server.

### `PATCH /auth/context`

```json
{ "companyId": "<company-id>" }
```

- Allowed for `root` / `admin` only; `manager` / `agent` receive `403`
- Updates `activeCompanyId` in Redis; **same token**
- Response includes `token` (unchanged) plus updated user/company payload

### `GET /companies`

Authenticated list of companies (for the platform company switcher).

## Frontend behavior

- Login stores the token in `localStorage` (`session_token`)
- App shell calls `GET /auth/me` on bootstrap
- Company switcher is shown only for `root` / `admin`
- Placeholder nav links for Chat / History / Companies (later phases)
- Session page shows user, active company, and the current token (verify it does not change on switch)

## Manual test plan

1. `./scripts/up.sh -d` (or the step-by-step commands above)
2. Open http://localhost:8080 → sign in as `admin@example.com` / `Password123!`
3. Note the session token on the Session page
4. Switch company Bookshop → VPN SaaS; confirm active company updates and the token is unchanged
5. Log out; log in as `agent.bookshop@example.com` — no company switcher; `PATCH /auth/context` via curl returns `403`
6. Call `GET /auth/me` with the agent token — `activeCompany` is Bookshop

Example:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Password123!"}' | jq -r .token)

curl -s http://localhost:3000/auth/me -H "Authorization: Bearer $TOKEN" | jq

# list companies, then switch
COMPANY_ID=$(curl -s http://localhost:3000/companies -H "Authorization: Bearer $TOKEN" | jq -r '.[] | select(.name=="VPN SaaS") | .id')
curl -s -X PATCH http://localhost:3000/auth/context \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"companyId\":\"$COMPANY_ID\"}" | jq
```

## Repo layout

```
apps/api   NestJS + Prisma + Redis sessions
apps/web   React + Vite + Tailwind
docker-compose.yml
*.html / styles.css          Original UI boilerplate (reference)
bookshop_support_guidelines.txt
vpn_support_guidelines.txt   Kept for a later guidelines phase
```
