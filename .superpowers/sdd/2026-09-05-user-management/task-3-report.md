# Task 3 report

## Status

Implemented the guarded UsersModule HTTP API.

## Files

- Added `apps/api/src/users/users.controller.ts` with authenticated `GET`,
  `POST`, `PATCH`, and `DELETE` user endpoints.
- Added `apps/api/src/users/users.module.ts` with AuthModule and PrismaModule
  wiring.
- Registered UsersModule in `apps/api/src/app.module.ts`.
- Added `apps/api/src/users/users.controller.spec.ts` covering unauthenticated
  guard rejection, session/DTO forwarding, unknown-field validation, and
  module dependency injection.

## Tests and checks

- `cd apps/api && npm test -- --runInBand users.controller.spec.ts` — 4 passed.
- `cd apps/api && npm test -- --runInBand` — 59 passed.
- `cd apps/api && npm run build` — passed.
- `git diff --check` — passed.

## Scope

No frontend or chat service files were changed by Task 3. Existing unrelated
worktree changes in those areas were preserved and excluded from this commit.

## Commit

`feat: expose authenticated user management API`
