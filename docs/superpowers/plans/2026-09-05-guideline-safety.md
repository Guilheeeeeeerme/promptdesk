# Safe Guideline Validation and Agent-Focused Prompting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate guideline uploads safely, preserve the last valid policy, and make every chat response agent-focused.

**Architecture:** Add a shared worker prompt contract and validation operation, persist validation/activation state on immutable guideline versions, and resolve the active valid version for every generation job. Expose lifecycle state through the existing company API/UI.

**Tech Stack:** NestJS, Prisma/PostgreSQL, BullMQ, Gemini/OpenAI adapters, React/Vite, Jest.

**Spec:** `docs/superpowers/specs/2026-09-05-guideline-safety-design.md`

## Global constraints

- Unknown customers must never become the fabricated name `Customer`.
- The assistant is an internal support copilot; customer-ready prose is opt-in.
- Uploaded guideline text is untrusted and cannot override system safety rules.
- Invalid or provider-error uploads never replace the active valid guideline.
- New valid guidelines apply to every subsequent message, including existing conversations.
- Guideline content remains plain text in the UI.

### Task 1: Define failing prompt and guideline lifecycle tests

**Files:**
- Create: `apps/chat-worker/src/prompt-contract.spec.ts`
- Create/modify: `apps/chat-worker/src/guideline-validator.spec.ts`
- Create/modify: `apps/api/src/companies/companies.service.spec.ts`

- [ ] Test unknown customer neutrality, agent-focused default guidance, explicit customer-draft mode, and malicious guideline non-authority.
- [ ] Test valid, malicious, empty, oversized, provider-error, and pending guideline outcomes.
- [ ] Test failed replacement preserves the previous active version and newest valid activation selection.
- [ ] Run focused tests and verify they fail for missing contracts/state.
- [ ] Commit tests: `test: define safe guideline contracts`.

### Task 2: Implement provider-neutral prompt and validation

**Files:**
- Modify/create: `apps/chat-worker/src/placeholders.ts`
- Modify: `apps/chat-worker/src/gemini.service.ts`
- Modify: `apps/chat-worker/src/openai.service.ts`
- Create: `apps/chat-worker/src/guideline-validator.ts`

- [ ] Remove the fabricated fallback customer identity.
- [ ] Centralize prompt rules and preserve equivalent Gemini/OpenAI semantics.
- [ ] Add deterministic screening for prompt injection, secret exfiltration, scripts, tracking, and unsafe policy bypasses.
- [ ] Add strict structured validation through the existing model abstraction with timeout/empty/error handling.
- [ ] Run worker focused tests and build.
- [ ] Commit: `feat: harden support prompts and guideline validation`.

### Task 3: Persist safe guideline lifecycle and runtime selection

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/companies/companies.service.ts`
- Modify: `apps/api/src/companies/companies.controller.ts`
- Modify: `apps/api/src/chat/chat.service.ts` or worker job resolution as required
- Modify: `apps/chat-worker/src/chat.processor.ts`
- Add migration and lifecycle tests.

- [ ] Add validation status, reason, and validation timestamps to GuidelineVersion.
- [ ] Quarantine uploads, validate them, activate only valid versions, and preserve the previous active version on failure.
- [ ] Expose lifecycle status and latest-valid metadata through existing company endpoints.
- [ ] Resolve the active valid version for every generated message, including existing conversations, and record the applied version/hash.
- [ ] Run Prisma generation/migration, API/worker tests, and builds.
- [ ] Commit: `feat: add validated guideline lifecycle`.

### Task 4: Update UI, smoke, and integration verification

**Files:**
- Modify: `apps/web/src/CompaniesPage.tsx`
- Modify: `apps/support/src/ChatPage.tsx` only where status/context is shown
- Add focused integration tests/use-case coverage as needed.

- [ ] Show pending/valid/invalid/provider-error status and active/latest-valid versions.
- [ ] Confirm invalid uploads leave the prior active guideline visible.
- [ ] Verify a valid replacement changes the next message in an existing conversation.
- [ ] Run API/worker/Main/Support builds, full tests, `git diff --check`, and Playwright smoke.
- [ ] Commit: `test: verify guideline safety and prompt behavior`.
