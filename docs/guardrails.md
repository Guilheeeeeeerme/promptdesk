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
- Deterministic screening runs BEFORE any model call:
  `src/guideline-validator.ts` matches content against
  `MALICIOUS_GUIDELINE_PATTERNS` and blocks with zero provider spend.
- Guideline classification after the screen: **JEV Choice** when
  `JEV_GUIDELINE_MODE=active` (`src/jev.service.ts`, `src/jev-guideline.provider.ts`);
  Gemini/OpenAI remain the `off`/`shadow` path. Chat reply generation stays Gemini.
  See [intelligence-routing.md](./intelligence-routing.md).
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

- Chat replies use the pinned Gemini model (`GEMINI_MODEL`, default
  `gemini-2.5-flash-lite`). That is the cost/quality pin for this task.
- Guideline validation uses JEV when `JEV_GUIDELINE_MODE=active` and a
  `JEV_API_KEY` is set. Otherwise it calls the same pinned Gemini model once.
- There is no model ladder and no provider-order failover.

## 3. Pinned model

- `GEMINI_MODEL` is the only generation model. Retries repeat that model.
- `JEV_MODEL` (default `jev-1.13.0`) is the only JEV model.
- `JEV_BASE_URL` is `https://api.typesafe.ai` on every stack.

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

- Event-driven interactive tasks (chat reply, guideline validation) remain
  request-driven queues but are bounded by the rate limits and job-attempt
  caps above; never a poll loop, never unbounded concurrency.

## 6. Environment variables (canonical names)

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | (required) | Gemini key |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com` | Gemini API root |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Pinned chat model |
| `JEV_API_KEY` | (required for active JEV) | JEV key, unique per stack |
| `JEV_BASE_URL` | `https://api.typesafe.ai` | JEV API root |
| `JEV_MODEL` | `jev-1.13.0` | Pinned JEV model |
| `JEV_TIMEOUT_SECONDS` | `10` | JEV request timeout |
| `JEV_GUIDELINE_MODE` | empty | `off` / `shadow` / `active` |
| `LLM_RATE_LIMIT_PER_MINUTE` | strict | Worker per-entity minute budget |
| `LLM_DAILY_BUDGET` | strict | Worker per-entity daily budget |
| (per project, e.g. `CHAT_RATE_LIMIT_PER_MINUTE`) | strict | HTTP endpoint send caps |

See `.env.example` for the full annotated set.

## 7. OWASP LLM Top-10 mapping (2026)

| Risk (2026) | Enforcement point |
| --- | --- |
| LLM01 Prompt Injection | Fenced untrusted context (`buildSupportPrompt`); guideline create/upload quarantine + validator; Gemini validation uses separated systemInstruction |
| LLM02 Sensitive Information Disclosure | No secrets in prompts; no content logs; **Redis `chat:events` carries reply text** — treat Redis as sensitive; Socket.IO room auth is the client control |
| LLM03 Excessive Agency | Text-only LLM; no tools; job ownership checked before generation |
| LLM04 Supply Chain | Versioned registry; pinned `GEMINI_MODEL` and `JEV_MODEL` |
| LLM05 Data and Model Poisoning | Deterministic pre-LLM guideline screening; create-path no longer activates unvalidated guidelines |
| LLM06 Unbounded Consumption | HTTP send/upload caps + worker Redis `LLM_RATE_LIMIT_PER_MINUTE` / `LLM_DAILY_BUDGET` fail-closed before provider calls |
| LLM07 Misinformation | Prompt policy only; guidelines sticky-snapshotted per conversation |
| LLM08 Hidden Context Exposure | System instruction from registry only; assume discoverable |
| LLM09 Vector and Embedding Weaknesses | N/A (no vector store) |
| LLM10 Improper Output Handling | Plain-text React sinks; strict guideline verdict parsing |

### Redis chat-event threat (LLM02)

`EventsPublisher` publishes assistant `content` on Redis pub/sub for Socket.IO fan-out. Compromise of Redis or mis-scoped room subscription can expose conversation text. Mitigations: encrypt Redis in transit, restrict network ACL, and keep Socket.IO rooms bound to authenticated user/company (see gateway tests).
