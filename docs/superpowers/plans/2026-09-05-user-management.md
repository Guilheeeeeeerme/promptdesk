# User Management and Account Menus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure active-company user CRUD for root, admin, and manager roles, plus matching account menus in Main and Support.

**Architecture:** Add a dedicated NestJS UsersModule whose service derives company scope from `SessionData` and applies a role hierarchy before every mutation. Add a Prisma migration only for schema changes if needed; keep users associated with one company, hash passwords with bcrypt, and invalidate Redis sessions on deletion. Add a protected Main Users route and reuse the same account-menu interaction in both frontends.

**Tech Stack:** NestJS 11, Prisma 6/PostgreSQL, Redis/ioredis, bcrypt, React 19, React Router 7, Vite/Tailwind, Jest, Playwright MCP.

**Spec:** `docs/superpowers/specs/2026-09-05-user-management-design.md`

## Global Constraints

- Root/admin scope is the currently active company; manager scope is the manager's own company.
- Agents receive `403 Forbidden` and do not see the Users route.
- Admins cannot create, edit, promote, demote, or delete root users.
- Managers may manage agents only and may not assign privileged roles.
- No endpoint trusts a client-provided company ID for scope.
- Password hashes and passwords are never returned by API responses.
- Deleting a user invalidates that user's Redis sessions.
- Reject deleting or demoting the last root user.
- Conversation history is session-company scoped: agents see only their own
  conversations; managers, admins, and root see all conversations in the
  active company. History visibility does not grant platform-only write
  actions.
- Preserve `.playwright-mcp/` and `.serena/` as uncommitted local artifacts.

## File Map

- Create `apps/api/src/users/users.module.ts`: Nest module wiring.
- Create `apps/api/src/users/users.controller.ts`: guarded HTTP endpoints.
- Create `apps/api/src/users/users.service.ts`: scope, hierarchy, validation, hashing, and persistence.
- Create `apps/api/src/users/dto/create-user.dto.ts` and `update-user.dto.ts`: validated write contracts.
- Modify `apps/api/src/app.module.ts`: register UsersModule.
- Modify `apps/api/src/auth/session.service.ts`: invalidate all sessions for a user.
- Modify `apps/api/prisma/schema.prisma` only if migration-safe constraints are required.
- Create `apps/api/src/users/users.service.spec.ts`: service-level authorization and data tests.
- Modify `apps/api/src/chat/conversations.service.ts`: manager-inclusive
  company history visibility while preserving write/action guards.
- Create or modify `apps/api/src/chat/conversations.service.spec.ts`:
  role-scoped history and active-company isolation tests.
- Create `apps/web/src/UsersPage.tsx`: table, create/edit forms, and delete confirmation.
- Modify `apps/web/src/App.tsx`: `/users` route.
- Modify `apps/web/src/AppShell.tsx`: role-aware Users sidenav item and account-menu consistency.
- Modify `apps/web/src/types.ts`: user-management DTO types.
- Modify `apps/support/src/ChatPage.tsx` or its extracted header owner: account menu with always-visible username.
- Modify `apps/support/src/auth.tsx` only if logout/menu state needs shared auth behavior.

### Task 1: Define API contracts and authorization tests

**Files:**
- Create: `apps/api/src/users/users.service.spec.ts`
- Create: `apps/api/src/users/dto/create-user.dto.ts`
- Create: `apps/api/src/users/dto/update-user.dto.ts`

**Interfaces:**
- `CreateUserDto`: `email: string`, `name: string`, `role: SessionRole`, `password: string`.
- `UpdateUserDto`: optional `email`, `name`, `role`, and `password`.
- Service response type: `{ id: string; email: string; name: string; role: Role; companyId: string | null; createdAt: Date }`.

- [ ] Write tests for root/admin/manager/agent access, company isolation, role hierarchy, last-root protection, password non-disclosure, and invalid input.
- [ ] Run `cd apps/api && npm test -- --runInBand users.service.spec.ts`; confirm the new tests fail because UsersService does not exist.
- [ ] Add DTO decorators for email, non-empty name, enum role, and password length; make update fields optional while rejecting unknown fields through the existing global ValidationPipe.
- [ ] Re-run the focused test command and keep failures limited to missing service behavior.
- [ ] Commit: `test: define user management authorization contracts`.

### Task 2: Implement scoped user service and session invalidation

**Files:**
- Create: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/auth/session.service.ts`

**Interfaces:**
- `UsersService.list(session: SessionData): Promise<UserView[]>`.
- `UsersService.create(session: SessionData, dto: CreateUserDto): Promise<UserView>`.
- `UsersService.update(session: SessionData, id: string, dto: UpdateUserDto): Promise<UserView>`.
- `UsersService.remove(session: SessionData, id: string): Promise<{ ok: true }>`.
- `SessionService.destroyForUser(userId: string): Promise<void>`.

- [ ] Implement a private scope resolver: platform roles require `session.activeCompanyId`; manager uses the session company; agents throw `ForbiddenException`.
- [ ] Implement target lookup with `where: { id, companyId: scopedCompanyId }`, so cross-company IDs resolve as not found/forbidden without leaking records.
- [ ] Implement role checks: root may manage all roles; admin may manage non-root users; manager may manage agents only and may assign only `agent`.
- [ ] Hash create/reset passwords with bcrypt and normalize emails to lowercase.
- [ ] Reject duplicate emails, empty active-company scope, invalid role transitions, self-demotion, and deleting/demoting the last root in the relevant company/global root set.
- [ ] Implement `destroyForUser` with Redis `SCAN` over `session:*`, parse session payloads, and delete matching user sessions without logging token values.
- [ ] Return an explicit projection excluding `passwordHash`.
- [ ] Run `cd apps/api && npm test -- --runInBand users.service.spec.ts`; confirm all service tests pass.
- [ ] Commit: `feat: add tenant-scoped user management service`.

### Task 3: Expose guarded UsersModule endpoints

**Files:**
- Create: `apps/api/src/users/users.controller.ts`
- Create: `apps/api/src/users/users.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- `GET /users` → `UserView[]`.
- `POST /users` with `CreateUserDto` → `UserView`.
- `PATCH /users/:id` with `UpdateUserDto` → `UserView`.
- `DELETE /users/:id` → `{ ok: true }`.

- [ ] Add `@Controller('users')` and `@UseGuards(AuthGuard)` to all endpoints.
- [ ] Inject `AuthenticatedRequest` and pass only `req.session` plus route ID/DTO to UsersService; never accept `companyId` in DTOs.
- [ ] Register UsersModule in AppModule and verify Nest dependency injection compiles.
- [ ] Add controller-level tests for unauthenticated rejection and DTO validation, then run `cd apps/api && npm test -- --runInBand`.
- [ ] Commit: `feat: expose authenticated user management API`.

### Task 4: Add Main Users page and route

**Files:**
- Create: `apps/web/src/UsersPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/AppShell.tsx`
- Modify: `apps/web/src/types.ts`

**Interfaces:**
- `UserView` mirrors the API projection.
- Page calls `GET /users`, `POST /users`, `PATCH /users/:id`, and `DELETE /users/:id` through existing `apiFetch`.

- [ ] Add a Users item to `navItems` with visibility for root/admin/manager only; keep the API as the authority.
- [ ] Add `/users` under the authenticated shell and redirect unauthorized direct access to `/` or `/companies`.
- [ ] Render active company context, responsive user rows/cards, role badges, and empty/loading/error states.
- [ ] Add create/edit form fields for name, email, role, and password; restrict role options in the UI to the current actor's allowed set.
- [ ] Add delete confirmation and refresh the list after successful mutation; show API errors without clearing unrelated form state.
- [ ] Keep the always-visible Main account button/dropdown behavior intact.
- [ ] Run the web build in an isolated dependency directory: `npm run build`; confirm TypeScript and Vite succeed.
- [ ] Commit: `feat: add main user management screen`.

### Task 5: Match Support account-menu behavior

**Files:**
- Modify: `apps/support/src/ChatPage.tsx`
- Modify: `apps/support/src/auth.tsx` only if needed for shared menu logout callback.

- [ ] Replace the Support top-bar visible logout button with an always-visible username button at desktop and mobile widths.
- [ ] Open a menu on click containing the signed-in email and `Log out`; support Escape handling and preserve SSO return behavior after logout.
- [ ] Ensure no user-management controls or route appear in Support; Support remains a chat-only MFE.
- [ ] Run `cd apps/support && npm run build` using its available dependencies or an isolated install directory.
- [ ] Commit: `feat: align support account menu with main app`.

### Task 6: End-to-end verification and smoke coverage

**Files:**
- Modify: `apps/api/src/users/users.service.spec.ts` if any uncovered authorization case is found.
- Modify: `apps/api/src/chat/conversations.service.spec.ts` if any uncovered
  history-scope case is found.
- No product code changes unless a failing smoke assertion identifies a root cause.

- [ ] Run API tests and build: `cd apps/api && npm test -- --runInBand && npm run build`.
- [ ] Run web and support builds plus `git diff --check`.
- [ ] With Playwright MCP, verify root, admin, manager, and agent flows: login, company scope, Users visibility, create/edit/delete, forbidden actions, and last-root protection.
- [ ] Verify history scope: agents see only their own conversations; managers,
  admins, and root see all conversations in the active company, and changing
  the selected company changes the visible set.
- [ ] Verify Main and Support username menus at desktop/mobile widths and logout/session invalidation.
- [ ] Verify SSO from Main to Support after user creation and after logout.
- [ ] Verify the corrected GitLab pipeline configuration using `glab ci lint` when credentials are available; otherwise report remote-lint as unavailable and retain local syntax/diff evidence.
- [ ] Commit any test-only additions separately as `test: cover user management smoke paths`.
- [ ] Final review: `git status --short --branch`, confirm only intended project files are staged/pushed, and document generated artifacts separately.
