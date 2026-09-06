# Hostinger KVM 2 — Staging/Demo Deployment Runbook

Target: single Hostinger VPS running the full stack via `docker-compose.prod.yml`,
fronted by host nginx + Let's Encrypt.

## VPS facts

| Item | Value |
| --- | --- |
| VM ID | 1959274 |
| Plan | KVM 2 (2 vCPU / 8 GB / 100 GB NVMe) |
| OS | Ubuntu 24.04 LTS |
| IPv4 | 82.25.74.147 |
| SSH key | `ferre@ferre-Nitro-ANV15-51` (Hostinger key ID 573396, attached) |
| Local private key | `~/.ssh/hostinger_staging` |

Test: `ssh -i ~/.ssh/hostinger_staging root@82.25.74.147`

## URLs (Option A — role-based, project-agnostic)

- Main app: `app.demo.<your-domain>` → nginx → 127.0.0.1:8080 (web container)
- Support MFE: `support.demo.<your-domain>` → nginx → 127.0.0.1:8081 (support container)
- API stays internal; frontends proxy `/api` and `/socket.io` to the api container.

DNS needed (A records → 82.25.74.147):
- `app.demo.<your-domain>`
- `support.demo.<your-domain>`

## One-time VPS bootstrap

```bash
ssh -i ~/.ssh/hostinger_staging root@82.25.74.147
git clone git@git.toptal.com:screening-ops/Guilherme-ferreira.git /opt/demo   # use a deploy key or HTTPS token
cd /opt/demo
bash scripts/bootstrap-vps.sh          # first run creates .env; exit 1 on purpose
nano .env                              # set POSTGRES passwords, GEMINI_API_KEY, real domains
bash scripts/bootstrap-vps.sh          # installs docker/nginx/certbot, renders nginx conf
# add DNS records, wait for propagation, then:
certbot --nginx -d app.demo.<your-domain> -d support.demo.<your-domain> --redirect --agree-tos -m <email> --non-interactive
docker compose -f docker-compose.prod.yml up -d --build
```

`scripts/bootstrap-vps.sh` derives both public domains from `VITE_MAIN_ORIGIN` /
`VITE_SUPPORT_ORIGIN` in `.env` — set those to the real `https://` URLs.

## CI/CD deploy

The `deploy:hostinger` job (manual trigger) SSHes into the VPS and runs
`scripts/deploy.sh <sha>`: fetch → checkout → `docker compose up -d --build`.

Required GitLab CI/CD variables (Settings > CI/CD > Variables) — **must be added
manually**: the `screening-ops` token is Developer-level (30) and gets 403 from
the variables API.

| Variable | Value |
| --- | --- |
| `SSH_PRIVATE_KEY` | contents of `~/.ssh/hostinger_staging` (private key, incl. newlines) |
| `VPS_HOST` | `82.25.74.147` |
| `VPS_USER` | `root` |

Trigger: GitLab UI → pipeline → `deploy:hostinger` → Run.
To make it automatic, change `when: manual` to `when: always` for the main-branch rule.

## Files introduced by this branch

| File | Purpose |
| --- | --- |
| `docker-compose.prod.yml` | production stack (builds images on the VPS) |
| `apps/api/Dockerfile` | rewritten: multi-stage, self-contained |
| `apps/chat-worker/Dockerfile` | new: multi-stage (uses apps/api prisma schemas) |
| `apps/web/Dockerfile` | rewritten: builds Vite app inside Docker (root context for `apps/shared`) |
| `apps/support/Dockerfile` | same as web |
| `.dockerignore` (+ `apps/api`) | keeps build contexts small |
| `.env.prod.example` | template for `/opt/demo/.env` |
| `deploy/nginx/demo.conf.template` | host reverse proxy (rendered by bootstrap) |
| `scripts/bootstrap-vps.sh` | one-time VPS setup |
| `scripts/deploy.sh` | CI-driven deploy on the VPS |

## Notes

- Images build on the VPS (no registry configured on this GitLab instance).
- API entrypoint runs `prisma migrate deploy` + seed on every start.
- Ports 3000/8080/8081 are bound to 127.0.0.1 only — public traffic goes through host nginx.
- Reusing the VPS for another project: `docker compose -f docker-compose.prod.yml down -v`,
  wipe `/opt/demo`, clone the next repo — the `app.demo.*` / `support.demo.*` URLs stay valid.
