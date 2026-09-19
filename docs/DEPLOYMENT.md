# PromptDesk — deployment

PromptDesk is **Hostinger-only**: everything runs on the VPS `82.25.74.147`
(`ferredemo.dev`). No Supabase, no Cloudflare. The build/deploy machinery lives
in the private **infra** repo; this page explains what happens when you push.

## What runs where

| Place | What |
| --- | --- |
| GitHub Actions (`infra` repo) | `Deploy app` / `Migrate app` workflows |
| GHCR | `ghcr.io/guilheeeeeeerme/promptdesk/{api,chatworker,app,support}:<appSha>.<infraSha>` |
| VPS — Compose project `promptdesk` | `api` (NestJS, loopback `13000`), `chatworker` (BullMQ), `app` (web SPA, `18080`), `support` (MFE, `18081`) |
| VPS — shared `infra_data` | `postgres-promptdesk` (role `promptdesk`, DB `promptdesk`, schema `promptdesk`) and `postgres-promptdesk-chat` (role `promptdesk_chat`, DB `promptdesk_chat`, schema `promptdesk_chat`) — two containers, roles kept distinct; Redis DB `/0` |
| VPS — `infra_llm` | Headroom proxy for `chatworker` (`GEMINI_BASE_URL=http://headroom:8787`) |
| VPS — nginx + Let's Encrypt | `api|app|support.promptdesk.ferredemo.dev` → loopback ports |
| Hostinger DNS | A records → VPS |

Secrets: `/opt/infra/secrets/promptdesk.env` on the VPS, sourced from `infra/secrets/production.enc.yaml` (SOPS).

## Step by step: push → production

1. Push to `main`. `.github/workflows/deploy-infra.yml` sends `repository_dispatch`
   (`project=promptdesk`, this repo, the commit SHA) to `infra` using secret `INFRA_DISPATCH_TOKEN`.
2. `infra` → **Deploy app**:
   1. `resolve`: SHA must be the current head of `main` (older pushes are skipped).
   2. `build` (GitHub runner): `scripts/app_test.sh promptdesk` runs `npm ci`,
      `prisma:generate`, `npm test` in `apps/api`; `purge_gate.sh` rejects any Supabase
      reference; `build.sh` builds the shared deps base, `api`, `chatworker`, `app`
      (`apps/web`) and `support` from `infra/containers/promptdesk/*` and pushes to GHCR.
   3. `deploy` (VPS over SSH): `deploy.sh promptdesk <release> deploy` — pulls the images,
      **checks `prisma migrate status` for both schemas (fails closed if pending)**,
      `docker compose up -d --wait`, smoke (`/auth/me` → 401, app `/health`), promotes
      the release. Failure restores the previous release automatically.
3. Nothing else restarts: Argus and Quizzeira are separate Compose projects.

Manual trigger: `infra` → Actions → **Deploy app** → `project=promptdesk`, optional `sha`.

## Step by step: schema change (Prisma, dual schemas)

1. Add the migration under `apps/api/prisma/migrations` or `apps/api/prisma-chat/migrations` and push.
2. In `infra`, run **Deploy app** with `migrate=true` (or **Migrate app** then **Deploy app**).
   On the VPS this runs `docker compose run --rm api npx prisma migrate deploy` for
   `prisma/schema.prisma` and `prisma-chat/schema.prisma`, then `npm run seed:platform`.
   `seed_demo=true` adds `seed:demo`.
3. A plain deploy never migrates; the API image never migrates on start.

## Rollback

`infra` → **Deploy app** with the previous `sha`, or on the VPS:
`bash /opt/infra/repository/scripts/deploy.sh promptdesk <previous release> rollback`.

## Local

```bash
cp .env.example .env.local.docker && cp .env.local.docker .env
docker compose up --build   # or scripts/up.sh
```

Local Postgres pair is the Compose containers; there is no remote-DB mode.
Full infra view: `infra/docs/DEPLOYMENT.md`.
