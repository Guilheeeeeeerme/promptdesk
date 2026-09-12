# AGENTS.md — PromptDesk

Coding-agent rules for this repository. Project map: [CLAUDE.md](./CLAUDE.md), [README.md](./README.md). Guardrails contract: [docs/guardrails.md](./docs/guardrails.md).

## Scope

- Work inside `apps/` and `docs/` in this repo.
- Production Compose/Jenkins lives in **infra** — do not invent a parallel prod deploy path here.
- Prefer the smallest sufficient change. Avoid broad refactors and full-matrix test runs unless asked.

## Hard rules

- **Dual databases**: core (`prisma/`) and chat (`prisma-chat/`) stay separate — never merge schemas, clients, or Postgres roles.
- **SSO**: keep `SSO_RETURN_ORIGINS` allow-listing; no open redirects in MFE hash-token handoff.
- **LLM / prompts**: prompts belong in `apps/chat-worker/prompts/registry.yml`. Do not put untrusted guidelines or chat history into system instructions. Fail closed on contract violations. Do not log message or guideline content.
- **Provider policy**: Gemini-first with ranked failover; respect `LLM_PROVIDER_ORDER` and Redis model ladders — see `docs/guardrails.md`.
- **Env**: `.env.example` → `.env`; never commit secrets. Prod requires real provider keys for chat.
- This repo is the **reference** for OWASP-aligned LLM guardrails used by Argus and Quizzeira — do not weaken the contracts without an explicit task.

## Verification

```bash
cd apps/api && npm run prisma:generate && npm test && npm run lint
# worker / FE: run the package scripts for the apps you touched
```

## Communication

User-facing text in English.
