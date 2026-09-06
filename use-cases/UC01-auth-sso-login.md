# Use Case 01: SSO Login and Authentication Flow
*Optimized for Playwright MCP Agent Execution*

## Objective
Verify user authentication and seamless token handoff between the Main App (`http://localhost:8080`) and Support MFE (`http://localhost:8081`).

## Target URLs
- Main App: `http://localhost:8080/login`
- Support MFE: `http://localhost:8081`

## Playwright Agent Execution Steps
1. **Navigate to Main App Login:**
   - Call `playwright_browser_navigate` with `url: "http://localhost:8080/login"`
2. **Fill Credentials:**
   - Locate email input: `page.getByRole('textbox', { name: /email/i })` or `input[type="email"]`
   - Fill with: `admin@example.com`
   - Locate password input: `page.getByRole('textbox', { name: /password/i })` or `input[type="password"]`
   - Fill with: `Password123!`
   - Click submit button: `page.getByRole('button', { name: /login|sign in/i })`
3. **Verify Main Dashboard:**
   - Wait for URL change to `http://localhost:8080/` or dashboard element.
   - Capture snapshot via `playwright_browser_snapshot` to confirm login state.
4. **Test SSO Handoff to Support MFE:**
   - Navigate to `http://localhost:8081`.
   - Verify agent is automatically redirected to Main App SSO handoff (`/sso/handoff`) and redirected back to `http://localhost:8081/#token=...`.
   - Verify Support Chat interface loads successfully without login prompt.

## Expected Assertions
- User is successfully authenticated.
- Token is stored in localStorage / session storage.
- Support MFE inherits session via SSO hash handoff.
