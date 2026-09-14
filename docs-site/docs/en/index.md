# Ecosystem overview

<p>
  <img src="/icons/promptdesk.svg" alt="PromptDesk" width="40" height="40" />
  <img src="/icons/quizzeira.svg" alt="Quizzeira" width="40" height="40" style="margin-left:0.5rem" />
  <img src="/icons/argus.svg" alt="Argus" width="40" height="40" style="margin-left:0.5rem" />
</p>

<span class="status status-verified">VERIFIED</span> Three products share ops via the private **infra** repo (Jenkins on Hostinger) but have **no product API mesh** between them. LLM policy baseline lives in PromptDesk `docs/guardrails.md`.

| Product | Problem | Live surface |
| --- | --- | --- |
| **[PromptDesk](/en/promptdesk/architecture)** ![PromptDesk](/icons/promptdesk.svg){width=20} | Multi-tenant AI customer support (admin SSO + support MFE) | `*.promptdesk.ferredemo.dev` |
| **[Quizzeira](/en/quizzeira/architecture)** ![Quizzeira](/icons/quizzeira.svg){width=20} | Concurso study: ingest exams → generate bank → eval gate → study pills | `*.quizzeira.ferredemo.dev` |
| **[Argus](/en/argus/architecture)** ![Argus](/icons/argus.svg){width=20} | Multi-company vision triage (camera → VLM → HITL) | `*.argus.ferredemo.dev` |

## Shared planes (infra)

```mermaid
flowchart LR
  subgraph apps [App stacks]
    PD[PromptDesk]
    QZ[Quizzeira]
    AG[Argus]
  end
  subgraph shared [Shared planes]
    DATA[infra_data<br/>Postgres+pgvector Redis MinIO]
    LLM[infra_llm<br/>Headroom proxy]
    OBS[infra_obs<br/>Loki Alloy Grafana]
  end
  PD --> DATA
  QZ --> DATA
  AG --> DATA
  PD -.->|BASE_URL OK| LLM
  AG -.->|BASE_URL OK| LLM
  QZ -.->|Headroom OFF| LLM
  PD --> OBS
  QZ --> OBS
  AG --> OBS
```

| Plane | Role | Notes |
| --- | --- | --- |
| `infra_data` | Postgres (pgvector), Redis, MinIO | PromptDesk needs distinct roles `promptdesk` / `promptdesk_chat` |
| `infra_llm` | Headroom LLM proxy | <span class="status status-verified">VERIFIED</span> Quizzeira workers set `LLM_USE_HEADROOM=false` |
| `infra_obs` | Loki (24h), Alloy, Grafana | Shared observability |

## Cross-cutting LLM defaults

<span class="status status-verified">VERIFIED</span> where used:

- Provider order: **Gemini → OpenAI**
- Model rank refresh: **12h** (`MODEL_RANK_REFRESH_MS=43200000`)
- Canonical budgets: **20/min**, **500/day** (`LLM_RATE_LIMIT_PER_MINUTE` / `LLM_DAILY_BUDGET`)
- Headroom: Argus/PromptDesk via `GEMINI_BASE_URL` / `OPENAI_BASE_URL` OK; Quizzeira OFF by design

## How to read these docs

See [Status legend](/en/reference/status-legend). Claims that audits marked **NOT FOUND**, **PARTIAL**, or **UNUSED** are documented as gaps — not as shipping features.

## Start here

- [Guardrails standard](/en/standards/guardrails)
- [Comparison matrix](/en/reference/comparison-matrix)
- [Defaults cheatsheet](/en/reference/defaults-cheatsheet)
