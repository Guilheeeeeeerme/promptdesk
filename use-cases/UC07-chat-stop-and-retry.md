# Use Case 07: Chat Stop and Retry Actions
*Optimized for Playwright MCP Agent Execution*

## Objective
Verify the ability to cancel an in-flight support message generation ("Stop") and retry failed message generation ("Retry").

## Target URL
- `http://localhost:8081`

## Playwright Agent Execution Steps
1. **Trigger Message Generation:**
   - Navigate to `http://localhost:8081`.
   - Send a support message.
2. **Test Stop Action:**
   - While the assistant message is in the pending/processing state, locate and click the "Stop" button: `page.getByRole('button', { name: /stop|cancel/i })`.
   - Verify job status updates to cancelled and pending job stops.
3. **Test Retry Action (on failed job):**
   - Locate a failed assistant message (or simulate failure).
   - Click the **Retry** button: `page.getByRole('button', { name: /retry/i })`.
   - Verify fresh BullMQ generation attempts are enqueued and streamed over Socket.IO.

## Expected Assertions
- Stop button successfully cancels pending/processing LLM jobs and sets abort flags.
- Retry button successfully re-enqueues failed assistant messages for generation.
