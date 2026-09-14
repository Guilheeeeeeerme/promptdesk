<p align="center">
  <img src="branding/promptdesk.svg" alt="PromptDesk" width="72" height="72" />
</p>

# PromptDesk

Multi-tenant AI customer-support platform: admin SSO host, support-chat micro-frontend, and LLM orchestration with cost-ranked model failover.

## Live

| Application | URL |
| --- | --- |
| Admin (SSO host) | https://app.promptdesk.ferredemo.dev |
| Support MFE | https://support.promptdesk.ferredemo.dev |
| API | https://api.promptdesk.ferredemo.dev |

## Technical docs (GitHub Pages)

**https://guilheeeeeeerme.github.io/ferredemo-docs/** — ecosystem architecture site (`/en`, `/pt`). Hosted in dedicated repo [`ferredemo-docs`](https://github.com/Guilheeeeeeerme/ferredemo-docs). Agent update prompt: [`docs/prompts/update-gh-pages.md`](docs/prompts/update-gh-pages.md).

## AI engineering (audit-honest)

| Capability | Status |
| --- | --- |
| Gemini→OpenAI ladder, BullMQ chat-worker, fenced untrusted context, guideline quarantine | **VERIFIED** |
| Socket.IO job/status fan-out (not token streaming) | **VERIFIED** |
| Rank refresh 12h; budgets 20/min · 500/day canonical; session 86400s; attempts=3; timeout 30s; upload limit 10 | **VERIFIED** |
| Token streaming / token telemetry | **NOT FOUND** |
| `customer_draft` | **UNUSED** |
| Redis `chat:events` carries reply text (LLM02) | **PARTIAL** |

Guardrails SoT for the ecosystem: [`docs/guardrails.md`](docs/guardrails.md).

## Architecture snapshot

```
web (SSO) / support MFE → NestJS API → dual Postgres + Redis
                              │ enqueue BullMQ
                              ▼
                         chat-worker → LLM → Redis events → Socket.IO
```

Brand mark: [`branding/promptdesk.svg`](branding/promptdesk.svg) (desk blotter + reply bars + prompt spark).

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
| --- | --- |
| Main app | http://localhost:8080 |
| Support MFE | http://localhost:8081 |
| API | http://localhost:3000 |

## Deeper docs

- Agent map: [`CLAUDE.md`](CLAUDE.md) · [`AGENTS.md`](AGENTS.md)
- Observability notes: [`docs/observability.md`](docs/observability.md)
- Production deploy: private **infra** repo (Jenkins)
