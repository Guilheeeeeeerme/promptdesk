# Observability

<span class="status status-verified">VERIFIED</span> Shared plane `infra_obs`: **Loki** (24h retention), **Alloy**, **Grafana**.

```mermaid
flowchart LR
  A[App containers] --> AL[Alloy]
  AL --> L[Loki 24h]
  G[Grafana] --> L
```

## Product notes

| Product | Logging policy |
| --- | --- |
| PromptDesk | No message/guideline body logs; ids/statuses/models only |
| Quizzeira | Align with Promptdesk-compatible guardrails |
| Argus | Log ids/statuses — not raw frame/prompt payloads |

## What is not claimed

<span class="status status-notfound">NOT FOUND</span> as a shared product mesh: distributed tracing product API, unified Prometheus app metrics contract, or cross-app APM. Ops visibility is primarily logs → Loki → Grafana.
