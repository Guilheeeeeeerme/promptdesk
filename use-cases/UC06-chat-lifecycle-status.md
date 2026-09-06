# Use Case 06: Conversation Lifecycle and Final Status Enforcement
*Optimized for Playwright MCP Agent Execution*

## Objective
Verify conversation lifecycle statuses (`open`, `in_progress`, `solved`, `not_solved`), finality rules (blocking new messages on resolved chats), and reopening conversations.

## Target URL
- `http://localhost:8081`

## Playwright Agent Execution Steps
1. **Open Active Conversation:**
   - Navigate to Support MFE (`http://localhost:8081`) with an existing open chat.
2. **Mark Conversation as Solved:**
   - Locate status dropdown or action button (e.g., "Mark Solved" / status selector): `page.getByRole('combobox', { name: /status/i })` or `page.getByRole('button', { name: /solved/i })`.
   - Select `solved`.
3. **Verify Finality Restrictions:**
   - Attempt to type and send a new message in the chat input.
   - Verify input is disabled or submitting returns a conflict error toast indicating the conversation is finalized.
4. **Reopen Conversation:**
   - Change status back to `open` via the status selector.
   - Verify chat input is re-enabled and new messages can be successfully sent.

## Expected Assertions
- Final statuses (`solved`, `not_solved`) correctly enforce view-only mode and block new message generation.
- Changing status back to `open` successfully re-enables conversation activity.
