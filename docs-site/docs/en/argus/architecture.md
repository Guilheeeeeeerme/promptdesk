# Argus architecture

<span class="status status-verified">VERIFIED</span> Vision pipeline → API → admin/triage MFEs. Product i18n: **en + pt-BR**.

```mermaid
flowchart LR
  SG[stream-gateway go2rtc] --> SP[stream-prep]
  SP -->|frames:ready Redis| PE[prompt-eval]
  PE --> API[FastAPI + WS]
  API --> ADM[admin MFE]
  API --> TR[triage MFE]
  SP --> MINIO[(MinIO)]
  API --> PG[(Postgres+RLS+pgvector)]
  API --> RD[(Redis sessions)]
```

## Live LLM

<span class="status status-verified">VERIFIED</span> Live multimodal LLM calls run in **prompt-eval**. API LLM + Celery rank path is **unused** on the live triage path — see [known gaps](./known-gaps).
