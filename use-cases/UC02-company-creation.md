# Use Case 02: Company Creation via UI
*Optimized for Playwright MCP Agent Execution*

## Objective
Verify that platform administrators (`admin` / `root`) can create a new company with optional initial guidelines through the Main App UI (`http://localhost:8080`).

## Target URL
- `http://localhost:8080/companies` (or Main Dashboard navigation)

## Playwright Agent Execution Steps
1. **Authenticate as Admin:**
   - Navigate to `http://localhost:8080/login`.
   - Fill email (`admin@example.com`) and password (`Password123!`), then click Login.
2. **Navigate to Companies Management:**
   - Click the "Companies" link/tab: `page.getByRole('link', { name: /companies/i })`.
3. **Trigger Add Company Modal/Form:**
   - Click "Add Company" or "New Company" button: `page.getByRole('button', { name: /add company|new company/i })`.
4. **Fill Company Details:**
   - Fill company name input with `Test Enterprise`.
   - (Optional) Upload initial guideline file using file chooser or input: `page.locator('input[type="file"]').setInputFiles('/home/ferre/Code/Guilherme-ferreira/guidelines/bookshop-legitimate.txt')`.
   - Click "Save" or "Create Company" button.
5. **Verify Creation:**
   - Wait for the company list to update (`playwright_browser_wait_for` or snapshot).
   - Assert `Test Enterprise` appears in the company table/grid.

## Expected Assertions
- New company is successfully created and persisted in PostgreSQL.
- Initial guideline metadata (if uploaded) is correctly displayed.
