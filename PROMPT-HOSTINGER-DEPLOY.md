# PROMPT — "See what's new in main and deploy to Hostinger"

Copy the block below into an agent session (this branch must be checked out so the
infra files exist). Nothing here requires the GitLab CI variables — deployment is
agent-driven over SSH.

---

```text
Deploy the latest main of git@git.toptal.com:screening-ops/Guilherme-ferreira.git
to my Hostinger demo VPS.

Context:
- VPS: Hostinger KVM 2, Ubuntu 24.04, root@82.25.74.147
- SSH key: ~/.ssh/hostinger_staging  (usage: ssh -i ~/.ssh/hostinger_staging root@82.25.74.147)
- App home on VPS: /opt/demo (a clone of the repo; this local branch's deploy files live there)
- URLs: https://app.demo.<domain> (main app) and https://support.demo.<domain> (support MFE)
  — check /opt/demo/.env (VITE_MAIN_ORIGIN / VITE_SUPPORT_ORIGIN) for the real domains.

Steps:
1. git fetch origin and note origin/main's SHA.
2. SSH to the VPS and read the currently deployed SHA: cd /opt/demo && git rev-parse HEAD.
3. Show me what is new: git log --oneline --no-decorate <deployed-sha>..origin/main
   and a one-line-per-file diff stat (git diff --stat <deployed-sha>..origin/main | tail -20).
   If nothing is new, stop and say so — do not redeploy.
4. If there are new commits, deploy:
   ssh -i ~/.ssh/hostinger_staging root@82.25.74.147 "cd /opt/demo && bash scripts/deploy.sh <new-sha>"
5. Verify and report:
   - docker compose -f /opt/demo/docker-compose.prod.yml ps  (all healthy, chat-worker not crash-looping)
   - curl -s -o /dev/null -w "%{http_code}" https://app.demo.<domain>  (expect 200)
   - curl -s -o /dev/null -w "%{http_code}" https://support.demo.<domain>  (expect 200)
   - last 20 lines of api + chat-worker logs if anything looks off.
6. Summarize: what was deployed (SHAs + commit list), health of every service, and
   the two URLs to click.

Rules:
- The local branch chore/production-deploy is infra-only and must stay local — never push it.
- If the VPS has no /opt/demo yet or scripts/bootstrap-vps.sh has never run, say so and
  stop (bootstrap needs DNS + .env secrets first — see docs/HOSTINGER-DEPLOY.md).
- If chat-worker is restart-looping, check for 'GEMINI_API_KEY is required' in its logs;
  that means /opt/demo/.env needs the real key — do not invent one.
```
