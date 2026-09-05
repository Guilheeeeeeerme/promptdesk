# User Management and Account Menus

## Goal

Add a tenant-scoped user CRUD surface while enforcing role permissions at the
API boundary. Give the Main app and Support MFE the same responsive account-menu
interaction.

## Authorization model

All user endpoints require the existing bearer-token `AuthGuard` and operate on
the session's active company.

- Root: full CRUD for users in the active company; may assign any role, subject
  to last-root protection.
- Admin: full CRUD for non-root users in the active company; cannot create,
  edit, promote, demote, or delete root users.
- Manager: CRUD for agent users in the manager's own company; cannot manage
  privileged users or assign privileged roles.
- Agent: receives `403 Forbidden` and has no visible Users route.

No operation accepts a client-selected company ID. The server derives scope
from the authenticated session. Users cannot move themselves or another user
between companies.

Deleting a user invalidates that user's Redis-backed sessions. The API rejects
deleting or demoting the last root user. Passwords are write-only: create and
optional reset accept a password, while reads never expose password hashes.

## Conversation history visibility

Conversation history is scoped by both the session's active company and role:

- Agents may list, inspect, and update only conversations they own.
- Managers may list and inspect all conversations in their own company,
  including conversations owned by other managers and agents.
- Admins and root may list and inspect all conversations in the session's
  selected active company.

The server derives the company filter from the session and never trusts a
client-provided company identifier. Existing write permissions remain separate
from history visibility: managers may oversee all company threads without
receiving platform-only actions unless explicitly authorized.

## API

Create `UsersModule`, controller, service, and DTOs with:

- `GET /users` — list users in scope.
- `POST /users` — create a user in the active company.
- `PATCH /users/:id` — update name, email, role, and optionally reset password.
- `DELETE /users/:id` — guarded deletion and session invalidation.

Responses contain only `id`, `email`, `name`, `role`, `companyId`, and
`createdAt`.

## Main app UI

Add a `Users` sidenav route visible to root, admin, and manager. The page shows
the active company, a user table, create/edit forms, optional password reset,
and confirmation-protected deletion. UI actions are role-aware but remain
backed by server authorization. Direct access by agents redirects away.

The Main app account control remains visible at every breakpoint. Clicking the
username opens a menu containing the email and `Log out`.

## Support MFE UI

Replace the separate visible logout button with the same account control:

- username always visible in the Support top bar on desktop and mobile;
- click opens an account menu with email and `Log out`;
- logout preserves current behavior: invalidate the token/session and return
  through the Main app SSO handoff when appropriate.

## Verification

Add API tests for company isolation, role permissions, privileged-role
protection, last-root protection, password non-disclosure, session
invalidation, and conversation history visibility for every role. Run API tests
and builds, then use Playwright to verify each role, the Users route, scoped
history, both account menus, SSO, logout, and responsive layouts.
