# PromptDeck → Dokploy deploy runbook

> PromptDesk = NestJS API (`apps/api`) + chat-worker + **own** Postgres 16 (two
> databases, two roles) + **own** Redis (password, `noeviction`). Hostinger-only:
> **never** point the stack at Supabase. SPAs (`apps/web`, `apps/support`) live
> on Cloudflare Pages, not on the VPS — see `.github/workflows/pages.yml`.

## Files

| Path | Purpose |
| --- | --- |
| `deploy/compose.prod.yml` | the Dokploy Compose stack (name `promptdesk`) |
| `deploy/docker/{api,chatworker}.Dockerfile` | self-contained production images, built by CI from the repo root |
| `deploy/migrate.sh` | one-shot Prisma migration runner (both schemas), packaged **inside the api image** |
| `deploy/postgres/initdb/` | first-boot scripts: roles `promptdesk` / `promptdesk_chat` + their databases |
| `deploy/env.production.example` | full runtime env name list (paste real values only in the Dokploy panel) |
| `deploy/tiers/{16gb,8gb}.env` | memory-limit presets (`PD_*_MEM_LIMIT`) |

## Migration dependency choice (compose spec pattern)

`api` depends on `migrate` with `condition: service_completed_successfully` **and
`required: false`**, while `migrate` sits behind the `migrate` profile. That is
the cleanest compose-valid pattern: on a normal `up -d` the profile is inactive,
so `api` starts without waiting on anything; when the profile is enabled, `api`
genuinely waits for the one-shot runner to exit 0. Rancher/Dokploy's
`docker compose up -d` never spawns profiled services, so default deploys
cannot block on migrations, and rollbacks keep them off entirely.

## Panel steps (Dokploy)

1. **Create project → Compose stack** named `promptdesk`, provider **Generic
   Git**, repository URL + branch `production`, attach a **deploy key** (read
   only). Set the **compose file path** to `deploy/compose.prod.yml`.
2. **Paste secrets in the stack Environment** using
   `deploy/env.production.example` as the name list. Generate fresh passwords
   (e.g. `openssl rand -hex 24`). Required non-default keys: `POSTGRES_PASSWORD`,
   `POSTGRES_PROMPTDESK_PASSWORD`, `POSTGRES_PROMPTDESK_CHAT_PASSWORD`,
   `REDIS_PASSWORD`, `DATABASE_URL`, `CHAT_DATABASE_URL`, `GEMINI_API_KEY`
. Set `GIT_SHA` when triggering a
   manual run; CI normally injects it. Copy one of `deploy/tiers/*.env` into
   the same env if you want to pin memory limits explicitly.
3. **Deploy.** Dokploy runs `docker compose up -d`: postgres first boot runs
   `deploy/postgres/initdb/*` (roles + DBs), redis starts with the password,
   api pulls `ghcr.io/guilheeeeeeerme/promptdesk/api:production`
   (`pull_policy: always`), chat-worker likewise. No container ever migrates.
4. First release (before first deploy): run migrations once:
   in the stack's shell / Dokploy service editor:
   ```bash
   docker compose -f deploy/compose.prod.yml --profile migrate run --rm migrate
   ```
   Then deploy the stack again (webhook) so `api`/`chatworker` boot against a
   migrated schema.
5. **Webhook:** stack settings → Deploy Hook; store the URL as the GitHub
   secret `DOKPLOY_DEPLOY_HOOK_URL` in this repo. CI calls it at the end of a
   green `.github/workflows/deploy.yml`.

### Webhook handling

The hook redeploys this one stack only (Dokploy scoped the link to the stack).
It has no API key side-effects; an attacker who steals it can only re-deploy
this stack, not rewrite secrets. Do not expose it anywhere else in the repo.

## Rollback with SKIP_MIGRATIONS

Rollback = `workflow_dispatch` → `Deploy` with `sha` of a known-good release.
CI rebuilds/points `:production` there and calls the webhook. If the bad release
migrated the schema forward, also set **`SKIP_MIGRATIONS=1`** in the stack env
in the panel before triggering (compose `migrate` service then exits 0
immediately, so nothing re-runs migrations on restarts). Remove the variable
once you are on a back-current release.

## Smoke checklist after every release

- `GET https://api.promptdesk.ferredemo.dev/version` →
  `{"gitsha":"<released sha>","service":"promptdesk-api"}` (CI polls this).
- `GET /health` of the API — ok; admin login on
  `https://app.promptdesk.ferredemo.dev` works (SSO round trip).
- Hold a support chat WebSocket open 5 minutes without reconnects.
- `GET https://api.promptdesk.ferredemo.dev/internal/...` from outside → **404**
  (Traefik `noop@internal` router), never 401/200.
- chat-worker healthy (`docker inspect` health), one chat message reaches a
  reply (LLM keys valid).

## Verification of changes (no Docker needed locally)

```bash
python3 -c "import yaml;yaml.safe_load(open('deploy/compose.prod.yml'))"
bash -n deploy/migrate.sh deploy/postgres/initdb/*.sh
```

CI additionally runs the compose config + boots the full stack (postgres,
redis, migrate including a `SKIP_MIGRATIONS=1` pass, api, chatworker) and
greps `/version` for the released gitsha — see the `smoke` job.
