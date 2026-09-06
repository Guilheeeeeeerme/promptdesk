# Use Case 03: Guideline Upload and Replacement
*Optimized for Playwright MCP Agent Execution*

## Objective
Verify that authorized users (`admin`, `manager`) can upload and replace company support guidelines via the Companies UI (`http://localhost:8080`).

## Target URL
- `http://localhost:8080/companies`

## Playwright Agent Execution Steps
1. **Authenticate and Navigate:**
   - Log in as `admin@example.com` / `Password123!` at `http://localhost:8080/login`.
   - Navigate to Companies view (`http://localhost:8080/companies`).
2. **Select Company:**
   - Click on the "Bookshop" company row or "View Guidelines" button: `page.getByRole('button', { name: /view guidelines|bookshop/i }).first()`.
3. **Upload / Replace Guideline File:**
   - Locate the file input / upload button for guidelines: `page.locator('input[type="file"]')`.
   - Set file path: `/home/ferre/Code/Guilherme-ferreira/guidelines/bookshop-legitimate.txt`.
   - Click "Upload" or "Replace Guidelines" button: `page.getByRole('button', { name: /upload|replace/i })`.
4. **Verify Success Notification & Updated Metadata:**
   - Wait for success toast or confirmation message using `playwright_browser_wait_for`.
   - Take snapshot via `playwright_browser_snapshot` to verify updated timestamp and filename (`bookshop-legitimate.txt`).

## Expected Assertions
- Guidelines are successfully uploaded and stored in Postgres.
- UI reflects the updated guideline file name and modification timestamp.
