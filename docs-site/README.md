# Ferre ecosystem technical docs

VitePress site covering **PromptDesk**, **Quizzeira**, and **Argus**, plus shared standards owned by this monorepo’s guardrails baseline.

## Why this repo (site-home decision)

| Candidate | Outcome |
| --- | --- |
| `infra` | Shared ops owner, but the GitHub repo is **private** — unsuitable as the public Pages host. |
| `argus` / `quizzeira` | Public, but no existing Pages. |
| **`promptdesk`** | **Chosen.** Already had GitHub Pages enabled (`gh-pages` branch, legacy Vue masterclass at `https://guilheeeeeeerme.github.io/promptdesk/`). PromptDesk also owns the shared LLM guardrails SoT (`docs/guardrails.md`). |

This site **replaces** the old architecture-masterclass SPA with an ecosystem-wide, bilingual (`/en`, `/pt`) engineering docs site. Source of truth for claims is code audits; status tags (`VERIFIED` / `PARTIAL` / `UNUSED` / `NOT FOUND`) must stay honest.

## Local

```bash
cd docs-site
npm ci
npm run dev
npm run build
```

Project Pages base path: `/promptdesk/`.

## Deploy

GitHub Actions workflow `.github/workflows/deploy-pages.yml` builds this package and deploys via `actions/deploy-pages`.

## Keeping docs current

See [`../docs/prompts/update-gh-pages.md`](../docs/prompts/update-gh-pages.md).
