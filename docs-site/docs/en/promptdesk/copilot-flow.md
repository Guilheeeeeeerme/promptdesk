# Copilot flow

<span class="status status-verified">VERIFIED</span> Interactive chat is **request → queue → worker → status**, not token streaming to the browser.

```mermaid
sequenceDiagram
  participant U as Support UI
  participant A as API
  participant B as BullMQ
  participant W as chat-worker
  participant L as LLM
  participant R as Redis pub/sub
  U->>A: send message
  A->>A: rate limit + session
  A->>B: chat-generate job
  A-->>U: accepted / pending
  B->>W: consume
  W->>W: sticky guideline snapshot
  W->>L: fenced context prompt
  L-->>W: text reply
  W->>W: persist chat DB
  W->>R: chat:events content
  R->>A: fan-out
  A-->>U: Socket.IO status update
```

## Socket.IO semantics

<span class="status status-verified">VERIFIED</span> Emits **job/status** (and event payload including assistant content via Redis) — **not** token streaming.

## Prompt construction

- System instructions from **registry** (`registry.yml`)
- Untrusted conversation + guidelines only in **fenced** user-message context
- Sticky snapshot: `versionId = hash` of resolved guideline version at job time
