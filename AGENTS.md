# AGENTS.md — PromptDesk

Coding-agent rules for this repository.

| Reference | Doc |
| --- | --- |
| Project map | [CLAUDE.md](./CLAUDE.md) · [README.md](./README.md) |
| Guardrails contract (reference impl) | [docs/guardrails.md](./docs/guardrails.md) |
| Gemini+JEV routing | [docs/intelligence-routing.md](./docs/intelligence-routing.md) |

## Scope

- Work inside `apps/` and `docs/` in this repo.
- Production Compose and GitHub Actions workflows live in **infra** — GHA + GHCR is the sole supported production control plane (do not use Jenkins; VPS Jenkins removal is CONFIRM-gated in infra after GHA is proven). Do not invent a parallel prod deploy path here.
- Prefer the smallest sufficient change. Avoid broad refactors and full-matrix test runs unless asked.

## Hard rules

| Rule | Detail |
| --- | --- |
| **Dual DBs** | Core (`prisma/`) and chat (`prisma-chat/`) stay separate — never merge schemas, clients, or Postgres roles. |
| **SSO** | Keep `SSO_RETURN_ORIGINS` allow-listing; no open redirects in MFE hash-token handoff. |
| **LLM / prompts** | Prompts in `apps/chat-worker/prompts/registry.yml` only. Never put untrusted guidelines/chat history in system instructions. Fail closed. Do not log message or guideline content. |
| **Provider policy** | Gemini-first with ranked failover; respect `LLM_PROVIDER_ORDER`. JEV Choice for guideline validation (`JEV_GUIDELINE_MODE`, `apps/chat-worker/src/jev.service.ts`). See [docs/guardrails.md](./docs/guardrails.md). |
| **Env** | `.env.example` → `.env`; never commit secrets. Prod requires real provider keys. |
| **Guardrails reference** | This repo is the OWASP-aligned LLM guardrails reference for Argus and Quizzeira. Do not weaken contracts without an explicit task. |

## Verification

```bash
cd apps/api && npm run prisma:generate && npm test && npm run lint
# worker / FE: run the package scripts for the apps you touched
```

## Communication

User-facing text in English.
