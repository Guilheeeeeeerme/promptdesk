# Use Case 05: AI Support Chat Generation and Streaming
*Optimized for Playwright MCP Agent Execution*

## Objective
Verify the end-to-end chat flow on the Support MFE (`http://localhost:8081`): submitting a customer message, establishing Socket.IO connection for pending jobs, and receiving the AI-generated recommended response.

## Target URL
- `http://localhost:8081`

## Playwright Agent Execution Steps
1. **Navigate to Support MFE:**
   - Navigate to `http://localhost:8081` (SSO handoff logs in automatically if Main App session is active).
2. **Compose & Send Support Message:**
   - Locate chat input textarea: `page.getByRole('textbox', { name: /message|type a message/i })` or `textarea`.
   - Type message: `Hello, my order is delayed, can you check the tracking status?`
   - Click Send button: `page.getByRole('button', { name: /send/i })` or press `Enter`.
3. **Verify Pending State & Real-Time Stream:**
   - Observe the pending assistant message bubble appear in the chat transcript.
   - Wait for Socket.IO job update event (`playwright_browser_wait_for` text matching /completed/i or wait for the assistant reply text to render).
4. **Inspect Response:**
   - Capture snapshot via `playwright_browser_snapshot` to confirm the AI response adheres to company guidelines (e.g. acknowledging delay and offering assistance).

## Expected Assertions
- User message and pending assistant placeholder are persisted.
- Socket.IO connection streams updates correctly.
- Gemini successfully generates a guideline-compliant customer support response.
