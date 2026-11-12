# PromptDesk — deployment

PromptDesk owns its application deployment workflows. The NestJS API and BullMQ
chat-worker run in the existing Hostinger VPS Dokploy stack. The admin and support
SPAs run on Cloudflare Pages. Infra owns host operations, not an additional
PromptDesk release pipeline. PromptDesk does not use Supabase.

## What runs where

| Place | What |
| --- | --- |
| `.github/workflows/deploy.yml` | Backend tests, GHCR builds, Compose smoke, Dokploy webhook, release confirmation |
| GHCR | `ghcr.io/guilheeeeeeerme/promptdesk/{api,chatworker}:<sha>` and moving `:production` tags |
| VPS Dokploy stack | API, worker, Postgres 16 and Redis; `deploy/compose.prod.yml` |
| Postgres | Separate core/chat databases and roles, `promptdesk` and `promptdesk_chat` |
| `.github/workflows/pages.yml` | Builds and publishes `apps/web` and `apps/support` to production branch `main` |
| Cloudflare Pages | Projects `promptdesk-app` and `promptdesk-support`, serving app/support custom domains |
| Public API | `https://api.promptdesk.ferredemo.dev`, routed by the VPS edge |

CI bakes `GIT_SHA` into each runtime image. Do not override it in Compose or the
Dokploy environment: `/version` must identify the running image, including rollbacks.

Runtime secrets belong in the existing Dokploy stack environment. See
[`deploy/env.production.example`](../deploy/env.production.example) for names;
never commit real values. Frontend workflow secrets are `CLOUDFLARE_API_TOKEN`
(Pages project deployment permission) and `CLOUDFLARE_ACCOUNT_ID`.

## Push to production

Push to `main` starts two independent workflows:

1. **Deploy** tests API and worker, builds both runtime images, and starts a
   disposable Compose stack on the runner. Smoke exercises migrations for both
   schemas and verifies the API `/version` response.
2. After smoke succeeds, Deploy calls the existing `DOKPLOY_DEPLOY_HOOK_URL` and
   polls public `/version` for the expected SHA and `promptdesk-api` identity.
   Requests bypass caches and have their own timeout; overall confirmation is
   bounded. A timeout fails the workflow; it does not prove deployment stopped
   or rolled back. Inspect Dokploy and compare `/version` before retrying.
3. **Pages** checks credential presence before installing dependencies, builds both
   SPAs with production API/SSO origins, and publishes with `--branch=main`.
   Each Pages project's configured production branch must also be `main`.

API `/version` is the public release identity probe. The API has no `/health`
route; use `/auth/me` returning 401 to check the unauthenticated auth boundary.
The worker's `/health` reports process liveness only. None of these probes proves
provider availability or a complete chat round trip.

## Migrations and rollback

Core and chat schemas, clients and roles remain separate. CI migrations use
throwaway runner databases; they do not migrate production. Production migrations
are an explicit operation using the existing Dokploy stack's one-shot migration
service. Review and back up both databases first. Follow
[`deploy/README.md`](../deploy/README.md) for the stack procedure.

The Deploy workflow's `sha` input selects the source revision to check out and
build. For rollback, select a previously verified commit and check production
migration compatibility. `skip_migrations` exercises rollback migration skipping
in CI only; it does not set the VPS environment.

## Local

```bash
cp .env.example .env.local.docker && cp .env.local.docker .env
docker compose up --build
```

Local Compose runs its own Postgres pair and Redis. It is not a production
deployment path. Provider requests need valid local credentials.
