# Failure & limits

| Control | Default | Behavior |
| --- | --- | --- |
| Session TTL | **86400s** (24h) | Opaque Redis session |
| Chat job attempts | **3** | Then provider failover / fail closed |
| LLM timeout | **30s** | Per call |
| HTTP send rate | fixed 60s window | 429 when exceeded |
| Guideline upload | **10** | Hardcoded cap |
| Daily / minute budgets | 20/min, 500/day canonical | Worker fail-closed |

## Delivery caveats

<span class="status status-partial">PARTIAL</span> Redis pub/sub for `chat:events` is **at-most-once**. Durable state remains in Postgres-chat; a disconnected UI may miss a live update until refresh.
