# Defaults cheatsheet

## Shared

| Key | Value |
| --- | --- |
| Provider order | Gemini → OpenAI |
| Rank refresh | 12h |
| Budgets | 20/min, 500/day |

## PromptDesk

| Key | Value |
| --- | --- |
| Session | 86400s |
| `CHAT_JOB_ATTEMPTS` | 3 |
| LLM timeout | 30s |
| `GUIDELINE_UPLOAD_LIMIT` | 10 (hardcoded) |

## Quizzeira

| Key | Value |
| --- | --- |
| Study/quality/corrector | 60s |
| content-worker | 120s |
| Crawler | 30m |
| Source intervalSec | 1800 |
| Politeness | 1000ms |
| Eval | 0.8 / 0.5 |
| BANK_READY | ≥5 |
| MIN_KU / TARGET | 4 / 12 |
| PUBLISHED_TARGET | 40 |
| Embeddings | 768d |
| Headroom | false |

## Argus

| Key | Value |
| --- | --- |
| SAMPLE_FPS | 1 |
| Window | 6 |
| Poll | 30s |
| Confidence | 0.5 |
| RAG_LIMIT | 5 |
| Lookback | 900s |
| VLM timeout | 60s |
| Session | 7d |
