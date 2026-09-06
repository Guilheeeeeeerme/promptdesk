# Use Case 04: Guideline File Size Limit Verification
*Optimized for Playwright MCP Agent Execution*

## Objective
Verify that uploading an oversized guideline file (>10MB, e.g., `vpn-too-big.txt`) is correctly rejected by the system with a clear error message.

## Target URL
- `http://localhost:8080/companies`

## Playwright Agent Execution Steps
1. **Authenticate and Navigate:**
   - Log in as admin and go to Companies page (`http://localhost:8080/companies`).
   - Open a target company guideline management modal/view.
2. **Attempt Upload of Oversized File:**
   - Locate file input: `page.locator('input[type="file"]')`.
   - Set file path to oversized file: `/home/ferre/Code/Guilherme-ferreira/guidelines/vpn-too-big.txt`.
   - Click "Upload" or submit form.
3. **Capture Error State:**
   - Wait for error toast or alert banner: `playwright_browser_wait_for` with text matching /size|exceed|limit|error/i.
   - Capture accessibility snapshot via `playwright_browser_snapshot`.

## Expected Assertions
- System rejects the file upload because it exceeds the 10MB limit.
- UI displays a clear validation error message preventing persistence.
