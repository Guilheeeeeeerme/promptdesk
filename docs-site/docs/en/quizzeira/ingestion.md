# Ingestion

<span class="status status-verified">VERIFIED</span> Discovery crawler pulls public exam sources into Discovery Postgres + MinIO on a schedule.

```mermaid
flowchart LR
  SRC[Public exam sources] -->|politeness 1000ms| CR[discovery-crawler]
  CR -->|intervalSec 1800 / loop 30m| STORE[(Discovery PG + MinIO)]
  STORE --> CONTENT[Content plane intake]
```

## Defaults

| Knob | Value |
| --- | --- |
| Crawler loop | 30m |
| Source `intervalSec` | 1800 |
| Politeness | 1000ms |

## No bank seed

<span class="status status-verified">VERIFIED</span> There is **no question-bank seed**. Seeds are users only. Bank fills via Ingestion → Content → Eval.
