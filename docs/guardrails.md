# OWASP LLM Guardrails Standard

promptdesk is the reference implementation. Every project that calls an LLM
(argus, quizzeira, ...) must align with the contracts below. File paths
reference promptdesk; each project maps them to its equivalent locations.

## 1. Enforcement model (policy layer)

- Policy and all prompts live in a versioned file:
  `apps/chat-worker/prompts/registry.yml`. No prompt strings in code.
- The loader (`src/prompt-registry.ts`) strictly validates the file at startup:
  version must be 1, every entry needs complete metadata
  (id/kind/purpose/when/audience/variables/security/output_contract/template),
  duplicate ids fail. Missing or malformed registry = boot failure.
- Deterministic screening runs BEFORE any LLM call:
  `src/guideline-validator.ts` matches content against
  `MALICIOUS_GUIDELINE_PATTERNS` and blocks with zero LLM spend.
- System instructions are code-controlled and built by the application
  (`src/chat.constants.ts` `buildSupportPrompt`); users never author them.
- Untrusted data (conversation history, agent text, company guidelines) may
  enter only inside one fenced, delimited JSON block in the user message
  (`support.copilot.context` template). Never interpolated into the system
  instruction.
- Strict output parsing: LLM verdicts/fields outside the declared contract
  ("valid" | "invalid" | "malicious") are treated as errors
  (`guideline-validator.ts`). Unknown values fail closed.
- Never log message content or guideline content; log ids, statuses, models,
  and error messages only.
- Least privilege: LLM produces text only, no tools, no writes.

## 2. Provider layer contract

- Gemini-first product policy: OpenAI is an optional cross-provider fallback
  (`src/provider-policy.ts`, `src/chat.processor.ts`).
- `LLM_PROVIDER_ORDER` (comma-separated, e.g. `openai,gemini`) is honored by
  both call sites. Semantics (`resolveProviderOrder` in
  `src/provider-policy.ts`):
  - unset/empty or unknown-names-only falls back to the default
    `gemini,openai`, which keeps current behavior exactly;
  - unknown provider names are ignored;
  - a provider whose API key is not configured is skipped.
- Chat dispatch: fresh jobs start at the head of the resolved order; the
  failed-attempt failover block re-enqueues with the next provider in order
  (`src/chat.processor.ts`, `nextProviderAfter` / `failoverToProvider`).
- Model-per-attempt: BullMQ attempt N maps to Redis-ranked model index N-1
  for that provider (`resolveModel`), so retries move up the cheapest models.
- Cross-provider failover happens only after ALL attempts on the current
  provider fail. The last provider in order fails closed (no silent success,
  no unbounded retry loops).
- A provider without a key is skipped at order resolution; with the default
  order and no `OPENAI_API_KEY`, behavior is identical to the old
  gemini-only path.

## 3. Cheapest-model rank contract

- `src/model-rank.service.ts` builds a per-provider cheapest model list:
  seeds (`SEED_*_INPUT_USD` in `src/model-rank.constants.ts`) + live
  models.list + pricing enrichment, cached in Redis
  (`models:rank:{provider}`, `models:rank:updatedAt`).
- `MODEL_RANK_TOP_N=3`: only the three cheapest models are ever used.
- `MODEL_RANK_REFRESH_MS` defaults to 43200000 (12h = twice daily); a failed
  refresh keeps the last good rank, and hardcoded verified defaults
  (`DEFAULT_GEMINI_RANK`, `DEFAULT_OPENAI_RANK`) are used when Redis is empty
  and refresh fails.

## 4. Rate limiting contract

- All HTTP-facing LLM-triggering endpoints are capped by a Redis
  fixed-window counter per entity (INCR + TTL on a window-bucket key), e.g.
  `enforceSendRateLimit` in `apps/api/src/chat/chat.service.ts`
  (`chat:rate:{companyId}:{userId}:{bucket}`, 60s window,
  `CHAT_RATE_LIMIT_PER_MINUTE`). Reject with 429 past the cap.
- Upload/bulk endpoints cap LLM-triggering quantity, e.g.
  `GUIDELINE_UPLOAD_LIMIT` in `apps/api/src/companies/companies.service.ts`.
- Canonical worker-budget naming for other projects:
  `LLM_RATE_LIMIT_PER_MINUTE` (worker-side per-entity requests/minute) and
  `LLM_DAILY_BUDGET` (per-entity daily request budget). Staging must default
  to the strictest values and count every request that reaches a model.

## 5. Background LLM schedule contract

- Periodic maintenance LLM tasks run on long windows:
  `ModelRankService` refreshes twice daily (`MODEL_RANK_REFRESH_MS`) via an
  unref'd `setInterval`, plus one refresh on startup; failures only warn.
- Event-driven interactive tasks (chat reply, guideline validation) remain
  request-driven queues but are bounded by the rate limits and job-attempt
  caps above; never a poll loop, never unbounded concurrency.

## 6. Environment variables (canonical names)

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | (required) | Primary provider key |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Default/override Gemini model |
| `OPENAI_API_KEY` | (optional) | Fallback provider key |
| `OPENAI_MODEL` | `gpt-5-nano` | Default/override OpenAI model |
| `LLM_PROVIDER_ORDER` | `gemini,openai` | Provider order; unknown ignored, keyless skipped |
| `MODEL_RANK_REFRESH_MS` | `43200000` | Rank refresh window (twice daily) |
| `MODEL_RANK_TOP_N` | `3` | Cheapest models actually used |
| `LLM_RATE_LIMIT_PER_MINUTE` | strict | Worker per-entity minute budget |
| `LLM_DAILY_BUDGET` | strict | Worker per-entity daily budget |
| (per project, e.g. `CHAT_RATE_LIMIT_PER_MINUTE`) | strict | HTTP endpoint send caps |

See `.env.example` for the full annotated set.

## 7. OWASP LLM Top-10 mapping

| Risk | Enforcement point |
| --- | --- |
| LLM01 Prompt Injection | Untrusted data only in the fenced context block (`src/chat.constants.ts` `buildSupportPrompt`); system instruction code-controlled; contract asserted in `src/prompt-contract.spec.ts` |
| LLM02 Sensitive Information Disclosure | Prompts give policy, not secrets; no content in logs (`guideline-validator.ts`, processors log ids/statuses only) |
| LLM03 Supply Chain | Policy file versioned + strictly validated (`apps/chat-worker/prompts/registry.yml`, `src/prompt-registry.ts`); pinned provider SDKs |
| LLM04 Data and Model Poisoning | Deterministic pre-LLM malicious-policy screening (`src/guideline-validator.ts`) before validation reaches a model |
| LLM05 Improper Output Handling | Strict contract parsing; unknown verdict = error, fail closed (`src/guideline-validator.ts`) |
| LLM06 Excessive Agency | LLM is text-only; no tool calls; job ownership checked before generation (`src/chat.processor.ts`) |
| LLM07 System Prompt Leakage | System instruction assembled only in code from the registry, never returns user content (`support.copilot.system`) |
| LLM08 Vector and Embedding Weaknesses | Not applicable (no vector store in the reference) |
| LLM09 Misinformation | Guideline versions validated end-to-end with status events; invalid/malicious never activated (`guideline-validation.lifecycle.ts`) |
| LLM10 Unbounded Consumption | Redis fixed-window rate limits + upload caps; cheapest-model rank (`MODEL_RANK_TOP_N=3`); prompt budget caps (`src/prompt-budget.ts`); bounded job attempts |
