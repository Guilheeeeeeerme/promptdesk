# Internal Copilot and Guideline Lifecycle Implementation Plan

**Goal:** Make support chat answer internal agents correctly, keep history/transcripts usable, and make guideline validation observable and cancellable.

**Architecture:** Preserve Gemini as the mandatory provider and OpenAI as optional. Add explicit internal-agent prompt semantics, a minimal support flex-layout fix, and a guideline event/cancellation path with immutable audit history and last-valid activation.

**Tech Stack:** NestJS, Prisma, BullMQ, Redis pub/sub, Socket.IO, React, Tailwind, Jest.

## Global Constraints

- Never treat an internal agent as the customer.
- Pending/processing guideline versions must never be used for chat.
- Cancelled versions remain in history and cannot be processed or activated.
- No Qwen, Ollama, or local model URL.
- Do not stage or commit changes.

### Task 1: Internal copilot prompt contract

Files: `apps/chat-worker/src/gemini.service.ts`, `apps/chat-worker/src/openai.service.ts`, `apps/chat-worker/src/chat.processor.ts`, prompt contract tests.

- Add failing tests for agent/customer labels, direct agent guidance by default, explicit customer-draft mode, and prompt secrecy.
- Pass a typed output mode through the chat job, defaulting to `agent_guidance`.
- Use delimited labeled context and provider-identical instructions.
- Run worker prompt tests/build.

### Task 2: Support history layout

Files: `apps/support/src/ChatPage.tsx` and support tests if available.

- Add a failing layout assertion or focused component test for bounded sidebar height.
- Add `min-h-0` to the sidebar flex item; preserve existing independent scroll panes.
- Run support build and browser smoke check with many conversations.

### Task 3: Guideline validation lifecycle

Files: API/core Prisma schema and migration, company service/controller/gateway, worker processor/events, web company page and dependencies.

- Add failing API/worker tests for cancellation-before-claim, stale completion, event payload, and history/active separation.
- Add `cancelled` status and atomic pending claim/cancel transitions.
- Add authorized cancel endpoint and best-effort BullMQ removal.
- Publish validation events through Redis/Socket.IO to authorized company members.
- Connect web UI to events, show only last-valid content in Replace, and add History tab with cancellation for pending/processing versions.
- Keep GET refetch as reconnect/resync fallback.
- Run migrations, focused tests, builds, and browser smoke tests.

### Task 4: Integrated verification

- Run API and worker tests/builds.
- Run web/support builds.
- Smoke prompt behavior, history scrolling, upload event, last-valid display, history, cancellation, and no-provider-call cancellation.
- Run `git diff --check` and report unstaged changes only.
