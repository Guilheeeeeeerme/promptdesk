# PromptDesk model ladder

<span class="status status-verified">VERIFIED</span> Redis-ranked cheapest models; BullMQ attempt maps to rank index.

| Setting | Default |
| --- | --- |
| Provider order | `gemini,openai` |
| Rank refresh | 12h |
| Top N | 3 |
| Job attempts | `CHAT_JOB_ATTEMPTS=3` |
| LLM timeout | **30s** |

Attempt **N** uses model index **N-1** on the current provider; after exhausting attempts, failover to the next provider in order.
