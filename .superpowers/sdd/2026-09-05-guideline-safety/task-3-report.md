# Task 3 report

## Status

Implemented validated guideline persistence, quarantine, valid-only activation,
latest-valid metadata, and execution-time guideline selection for chat replies.

## Files

- Added validation lifecycle fields and indexes to the core Prisma schema and a
  migration that backfills existing versions as valid.
- Added per-assistant-message guideline version/hash audit fields and migration.
- Updated `CompaniesService` to create pending immutable uploads, preserve the
  active company guideline on failed validation, activate the newest valid
  version, and expose validation metadata through existing company/version APIs.
- Updated the worker to resolve the newest valid guideline at job execution time,
  including jobs for existing conversations, and persist the applied version/hash.
- Marked seeded initial guideline versions as valid.

## Verification

- `DATABASE_URL=postgresql://localhost:5432/app npx prisma validate` — passed.
- `npm run prisma:generate` — passed for core and chat clients.
- `cd apps/api && NODE_OPTIONS=--experimental-vm-modules npm test -- --runInBand` — 62 passed.
- `cd apps/api && npm run build` — passed.
- `cd apps/chat-worker && npm run build` — passed.
- `git diff --check` — passed.

The worker package has no Jest runner or `@types/jest`, so its committed
contract specs could not be executed in this worktree; the worker production
build passed.

## Commit

Initial lifecycle commit: `7376af4 feat: add validated guideline lifecycle`.

## Follow-up: executable validation path

- Added `guideline-validate` queue registration to API and worker.
- Uploads enqueue validation automatically; managers/admins can retry through
  `POST /companies/:id/guidelines/versions/:versionId/validate`.
- Added provider-backed `validateGuideline` operations to Gemini/OpenAI and a
  worker processor that persists terminal status/reason/timestamp and activates
  only the newest valid version. Malicious deterministic results are persisted
  as `invalid` because the database lifecycle intentionally has four states.

Follow-up commit: `443a8c2 feat: execute guideline validation jobs`.
