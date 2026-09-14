# PromptDesk known gaps

Honest audit outcomes — do not document as shipping features.

| Item | Status | Notes |
| --- | --- | --- |
| Token streaming to UI | <span class="status status-notfound">NOT FOUND</span> | Socket.IO status path only |
| Token usage telemetry | <span class="status status-notfound">NOT FOUND</span> | No product token accounting surface |
| `customer_draft` | <span class="status status-unused">UNUSED</span> | Present but unused in live path |
| Client-only SSO allowlist | <span class="status status-partial">PARTIAL</span> | Risk if server allowlist drifts from client |
| Redis `chat:events` content | <span class="status status-partial">PARTIAL</span> | LLM02 — reply text on Redis pub/sub |
| Vector / RAG | <span class="status status-notfound">NOT FOUND</span> | No vector store in PromptDesk |
