# Comparison matrix

| Dimension | PromptDesk | Quizzeira | Argus |
| --- | --- | --- | --- |
| Domain | Support chat + guidelines | Exam → study bank | Vision triage |
| Primary stores | Dual Postgres + Redis | Discovery/Content PG + Study MySQL + Redis + MinIO | Postgres+pgvector + Redis + MinIO |
| Async model | **BullMQ** | **runLoop** intervals | Pipeline services + Celery (rank unused) |
| Live LLM process | chat-worker | content-worker / quality / corrector | **prompt-eval** |
| Headroom | BASE_URL OK | **OFF** | BASE_URL OK |
| Provider order | Gemini→OpenAI | Gemini→OpenAI (worker-kit) | Gemini→OpenAI |
| Rank refresh | 12h | where used | API path unused |
| Budgets | 20/min 500/day canonical | align | align |
| Streaming tokens | No | No | No |
| Agents | No | No | No |
| RAG | No | Embeddings 768d; search unused in gen | Partial; no query_embedding |
| Product i18n | — | — | en + pt-BR |
| Guardrails SoT | `docs/guardrails.md` | maps to same contracts | maps to same contracts |
