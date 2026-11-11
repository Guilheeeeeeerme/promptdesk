# Intelligence routing (PromptDesk)

Canonical cross-app contract: infra [`docs/intelligence-routing.md`](../../infra/docs/intelligence-routing.md).
Guardrails: [guardrails.md](./guardrails.md).

| Need | Owner |
| --- | --- |
| Support chat reply (free text) | **Gemini only**, pinned by `GEMINI_MODEL`; no model ladder or OpenAI failover |
| Guideline validation (closed `valid` / `invalid` / `malicious`) | **JEV Choice** when `JEV_GUIDELINE_MODE=active` |
| Deterministic pre-screen / output policy | Code (no LLM) |

## Modes

`JEV_GUIDELINE_MODE` ∈ `off | shadow | active`.

| Mode | Production decision | Cost |
| --- | --- | --- |
| `off` | Gemini/OpenAI guideline JSON | LLM only |
| `shadow` | Gemini/OpenAI | + JEV compare log — holdout only |
| `active` | **JEV** | No LLM validator |

Unset → `active` when `JEV_API_KEY` present, else `off`. Never leave production on `shadow`.

Panel secret: `JEV_API_KEY` (never reuse the Quizzeira or Argus key).
JEV hits `JEV_BASE_URL` direct. Gemini hits the public API.
