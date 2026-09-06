# Use Case 09: Role-Based Access Restrictions in UI
*Optimized for Playwright MCP Agent Execution*

## Objective
Verify that users with restricted roles (`agent`) cannot access platform admin features or modify company guidelines through the user interface.

## Target URL
- `http://localhost:8080` / `http://localhost:8081`

## Playwright Agent Execution Steps
1. **Login as Support Agent:**
   - Navigate to `http://localhost:8080/login` and log in with `agent.bookshop@example.com` / `Password123!`.
2. **Verify Tenant Switcher Absence:**
   - Inspect main header/navigation via `playwright_browser_snapshot`.
   - Assert that the company switcher / tenant selector is hidden or disabled for `agent` role.
3. **Verify Guideline Write Restrictions:**
   - Navigate to Companies view or attempt to access guideline management endpoints/UI.
   - Assert that upload/replace guideline buttons are either hidden or return `403 Forbidden` when accessed.

## Expected Assertions
- Support agents have read-only access to their assigned company.
- Tenant switching and guideline editing controls are strictly restricted to `admin` / `root` / `manager` roles.
