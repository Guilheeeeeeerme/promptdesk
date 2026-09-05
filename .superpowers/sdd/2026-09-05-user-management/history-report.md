# Conversation history visibility

## Scope

- Root, admin, and manager history reads are scoped to `session.activeCompanyId` and exclude soft-deleted conversations.
- Agents remain scoped to conversations owned by `session.userId` in the active company.
- The rule applies consistently to list, detail, and messages reads.
- Owner enrichment now applies consistently to manager history reads as well as root/admin reads.
- Existing platform-only summary and manual-reply guards remain unchanged; the existing writable conversation gate is also unchanged.

## Implementation

- Added a service-local history read predicate for root/admin/manager roles.
- Added a separate readable-conversation gate so expanding history visibility does not expand write access.
- Added focused service tests covering role scope, active-company/deleted isolation, owner enrichment, detail/messages access, agent owner isolation, and summary/reply guard preservation.

## Verification

- `CI=1 npx jest --runInBand src/chat/conversations.service.spec.ts --verbose` — 11 tests passed.
- `npm run build` — passed.
- `CI=1 npm test -- --runInBand` — 3 suites / 54 tests passed; 1 pre-existing suite failed because `src/users/users.controller.spec.ts` imports missing `./users.controller`. Users files were not changed by this task.
