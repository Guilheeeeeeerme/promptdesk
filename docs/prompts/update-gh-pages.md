# Prompt: update GitHub Pages (ecosystem docs) — PromptDesk

Use this when PromptDesk architecture, chat-worker / model ladder, SSO,
guidelines, or guardrails change and the shared ecosystem docs may be stale.

**Ecosystem docs live only in ferredemo-docs** — never recreate a multi-product
VitePress site (or Pages deploy) inside this repository.

| | |
| --- | --- |
| **Docs repo** | https://github.com/Guilheeeeeeerme/ferredemo-docs |
| **Live URL** | https://guilheeeeeeerme.github.io/ferredemo-docs/ |
| **Full SoT prompt** | https://github.com/Guilheeeeeeerme/ferredemo-docs/blob/main/prompts/update-gh-pages.md |

Product branding, icons, and README links in **this** repo may point at that
URL. Edits and deploys happen in **ferredemo-docs** only.

## 1. Identify relevant commits / diffs (this repo)

Collect commits since the last docs update that touch PromptDesk paths such as:

| Area | Typical paths |
| --- | --- |
| LLM / chat | `apps/chat-worker/**`, `apps/api/src/chat/**`, `apps/api/src/companies/**`, `apps/chat-worker/prompts/registry.yml` |
| Guardrails | `docs/guardrails.md`, screening / OutputPolicy paths in API or worker |
| Auth / SSO | `apps/shared/auth/**`, `SSO_RETURN_ORIGINS`, session TTL |
| Frontends | `apps/web/**`, `apps/support/**` (architecture edges only) |
| Defaults | `MODEL_RANK_*`, `LLM_PROVIDER_ORDER`, budgets, Redis ladder keys |

Record **SHA range** (or single SHAs) and a one-line summary per commit.
Cross-check sibling repos (`infra`, shared standards) only when those diffs
affect PromptDesk claims.

**Do not invent** Agents, token streaming, full semantic RAG, or other
capabilities without code evidence.

## 2. Diff against documented claims

In a checkout of **ferredemo-docs**, open matching Pages under `docs/en/**`
(and `pt/**` if translated) and check:

- Defaults tables (intervals, TTLs, budgets, thresholds)
- Mermaid diagrams (new/removed services or edges)
- Status tags: `VERIFIED` / `PARTIAL` / `UNUSED` / `NOT FOUND`
- Comparison matrix + defaults cheatsheet + known-gaps

Upgrade/downgrade tags **only** with code evidence. Prefer citing
`path:symbol` in the PR body.

## 3. Update only affected sections (in ferredemo-docs)

Edit the smallest set of markdown under `docs/` in **ferredemo-docs**, not here.

PromptDesk checklist (paths relative to ferredemo-docs `docs/`):

- [ ] `en/promptdesk/architecture.md` / `copilot-flow.md` / `guidelines.md`
- [ ] `en/promptdesk/model-ladder.md` / `failure-and-limits.md` / `known-gaps.md`
- [ ] `en/standards/guardrails.md` / `model-ladder-and-budgets.md`
- [ ] `en/reference/defaults-cheatsheet.md` / `comparison-matrix.md`
- [ ] `en/reference/not-in-scope.md` if a capability was wrongly implied
- [ ] PT mirrors for any page you substantially changed

Preserve status-tag HTML (`<span class="status …">`). Keep EN canonical.
Never document unused code as live behavior.

## 4. Rebuild and deploy (ferredemo-docs)

```bash
# from ferredemo-docs checkout
npm ci
npm run build
```

Push/merge to `main` in **ferredemo-docs**. Workflow
`.github/workflows/deploy-pages.yml` builds and deploys Pages.

Confirm Actions green and
`https://guilheeeeeeerme.github.io/ferredemo-docs/` serves updated `/en/` content.

## Done criteria

1. SHAs + claim deltas listed in the ferredemo-docs PR
2. `npm run build` succeeds in ferredemo-docs
3. Pages workflow green on ferredemo-docs only
4. No new undocumented “Agents / streaming / full RAG” claims
5. This product repo was **not** given a VitePress tree or Pages workflow
