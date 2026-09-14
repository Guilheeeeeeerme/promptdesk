# Quizzeira architecture

<span class="status status-verified">VERIFIED</span> Three planes: **Discovery**, **Content**, **Study**. Workers use **runLoop** intervals — not BullMQ.

```mermaid
flowchart TB
  subgraph discovery [Discovery]
    DA[discovery-api]
    DC[discovery-crawler]
    DPG[(Postgres quizzeira_discovery)]
    MINIO[(MinIO)]
  end
  subgraph content [Content]
    CA[content-api]
    CW[content-worker]
    CQ[content-quality]
    CPG[(Postgres+pgvector quizzeira_content)]
  end
  subgraph study [Study]
    API[api]
    WEB[web]
    QC[quiz-corrector]
    MY[(MySQL)]
    RD[(Redis)]
  end
  DC --> DPG
  DC --> MINIO
  CW --> CPG
  CQ --> CPG
  API --> MY
  API --> RD
  QC --> MY
```

## Intervals (defaults)

| Loop | Interval |
| --- | --- |
| Study / quality / corrector | **60s** |
| content-worker | **120s** |
| Crawler | **30m** |
| Source `intervalSec` | **1800** |
| Politeness delay | **1000ms** |

## LLM / Headroom

<span class="status status-verified">VERIFIED</span> `LLM_USE_HEADROOM=false` — workers do not join Headroom without fixing network/auth (infra `docs/quizzeira-headroom.md`).

## Spec SoT

<span class="status status-verified">VERIFIED</span> Crawler redesign SoT: `docs/crawler-redesign-spec.md` wins over `specs/001-crawler-redesign/spec.md` (Ralph compatibility only; **specs/001 missing** content parity).
