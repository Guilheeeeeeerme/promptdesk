# Prompt: update GitHub Pages (ecosystem docs)

Use this when architecture, AI pipelines, defaults, or guardrails change in
`quizzeira`, `argus`, `promptdesk`, or `infra`, and the shared VitePress site
may be stale.

**Site home:** `promptdesk/docs-site/` (GitHub Pages project site).
**Live URL:** `https://guilheeeeeeerme.github.io/promptdesk/`
**Do not invent** Agents, token streaming, full semantic RAG, Quizzeira bank
seeds, or Quizzeira Headroom-on without evidence.

## 1. Identify relevant commits / diffs

Across the four repos, collect commits since the last docs update that touch:

| Area | Typical paths |
| --- | --- |
| PromptDesk LLM / chat | `apps/chat-worker/**`, `apps/api/src/chat/**`, `apps/api/src/companies/**`, `prompts/registry.yml`, `docs/guardrails.md` |
| PromptDesk auth / SSO | `apps/shared/auth/**`, `SSO_RETURN_ORIGINS`, session TTL |
| Quizzeira planes | `apps/discovery-*`, `apps/content-*`, `apps/api`, `apps/quiz-corrector`, `packages/worker-kit`, `docs/crawler-redesign-spec.md`, `.env.sample`, compose |
| Argus pipeline | `services/stream-*`, `services/prompt-eval`, `apps/api/**`, RAG/session env, registries |
| Shared standards / ops | `infra` Headroom/obs docs, budget/rank env names mirrored in apps |

Record **repo → SHA range** (or single SHAs) and a one-line summary per commit.

## 2. Diff against documented claims

For each changed area, open the matching Pages section under
`docs-site/docs/en/**` (and `pt/**` if translated) and check:

- Defaults tables (intervals, TTLs, budgets, thresholds)
- Mermaid diagrams (new/removed services or edges)
- Status tags: `VERIFIED` / `PARTIAL` / `UNUSED` / `NOT FOUND`
- Comparison matrix + defaults cheatsheet + known-gaps

Upgrade/downgrade tags **only** with code evidence. Prefer citing path:symbol
in the commit summary you leave in the PR body.

## 3. Update only affected sections

- Edit the smallest set of markdown files under `promptdesk/docs-site/docs/`.
- Preserve status-tag HTML (`<span class="status …">`) conventions.
- Keep EN as canonical; update PT stubs or full pages in parallel when the claim
  changed.
- Never document unused code as live behavior.

## 4. Rebuild and deploy

```bash
cd docs-site
npm ci
npm run build
```

Push to `main` (or merge PR). Workflow
`.github/workflows/deploy-pages.yml` builds and deploys Pages.

If Pages source is not GitHub Actions yet:

```bash
gh api -X POST repos/Guilheeeeeeerme/promptdesk/pages \
  -f build_type=workflow \
  -f source[branch]=main -f source[path]=/
# or switch existing site:
gh api -X PUT repos/Guilheeeeeeerme/promptdesk/pages \
  -f build_type=workflow
```

Confirm the Actions run and the live URL.

## 5. Checklist — files that usually need doc updates

### PromptDesk

- [ ] `en/promptdesk/architecture.md` / `copilot-flow.md` / `guidelines.md`
- [ ] `en/promptdesk/model-ladder.md` / `failure-and-limits.md` / `known-gaps.md`
- [ ] `en/standards/guardrails.md` / `model-ladder-and-budgets.md`
- [ ] `en/reference/defaults-cheatsheet.md` / `comparison-matrix.md`

### Quizzeira

- [ ] `en/quizzeira/architecture.md` / `ingestion.md` / `content-generation.md`
- [ ] `en/quizzeira/eval-gate.md` / `sampling-and-study.md` / `embeddings-and-retrieval.md`
- [ ] `en/quizzeira/known-gaps.md`
- [ ] Defaults cheatsheet (intervals, eval 0.8/0.5, BANK_READY, KU targets)

### Argus

- [ ] `en/argus/architecture.md` / `vision-pipeline.md` / `prompt-eval-and-vlm.md`
- [ ] `en/argus/hitl-triage.md` / `rag-and-feedback.md` / `known-gaps.md`
- [ ] Defaults (SAMPLE_FPS, WINDOW, POLL, confidence, RAG_LIMIT, LOOKBACK, VLM timeout, session)

### Infra / shared

- [ ] `en/index.md` shared planes diagram
- [ ] `en/standards/observability.md`
- [ ] Headroom notes (Quizzeira OFF)

### Always

- [ ] `en/reference/not-in-scope.md` if a capability was wrongly implied
- [ ] PT mirrors for any page you substantially changed
- [ ] `docs-site/README.md` only if site home / deploy mechanics change

## Done criteria

1. SHAs + claim deltas listed in the PR
2. `npm run build` succeeds in `docs-site`
3. Pages workflow green; URL serves updated `/en/` content
4. No new undocumented “Agents / streaming / full RAG” claims
