# Content generation

<span class="status status-verified">VERIFIED</span> content-worker runLoop (**120s**) extracts/generates draft items into the content bank (pgvector).

## Targets

| Constant | Value |
| --- | --- |
| `BANK_READY` threshold | **≥ 5** |
| `MIN_KU` / `TARGET` | **4 / 12** |
| `PUBLISHED_TARGET` | **40** |

## Unused hooks

| Symbol | Status |
| --- | --- |
| `searchChunks` during generation | <span class="status status-unused">UNUSED</span> |
| `googleSearch` | <span class="status status-unused">UNUSED</span> |
