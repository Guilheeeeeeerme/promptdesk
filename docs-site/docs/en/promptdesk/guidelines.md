# Guidelines

<span class="status status-verified">VERIFIED</span> Guidelines are versioned, hash-addressed, and quarantined until validation passes.

## Lifecycle

```mermaid
flowchart LR
  U[Upload / create] --> Q[Quarantine]
  Q --> D[Deterministic screen]
  D -->|malicious pattern| X[Reject]
  D -->|pass| V[LLM validate job]
  V -->|valid| A[Activate version]
  V -->|invalid/malicious| X
  A --> S[Sticky snapshot per conversation]
```

## Limits

| Control | Value | Notes |
| --- | --- | --- |
| `GUIDELINE_UPLOAD_LIMIT` | **10** | <span class="status status-verified">VERIFIED</span> hardcoded in API companies service |
| Validation queue | `guideline-validate` | Worker + registry contracts |
| Sticky snapshot | `versionId=hash` | Conversation pinned to validated version |

## Security

- Pre-LLM `MALICIOUS_GUIDELINE_PATTERNS`
- Fail closed on unknown LLM verdicts
- Never log guideline bodies
