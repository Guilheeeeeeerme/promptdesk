# Use Case 10: Chat History Browsing and Filtering
*Optimized for Playwright MCP Agent Execution*

## Objective
Verify that users can browse previous chat conversations, search/filter conversations, pin/archive items, and view full interaction transcripts.

## Target URL
- `http://localhost:8081` (or History MFE if available)

## Playwright Agent Execution Steps
1. **Navigate to Chat / History View:**
   - Open `http://localhost:8081` authenticated as `agent.bookshop@example.com`.
2. **Browse Conversation List:**
   - Locate conversation sidebar or history list: `page.getByRole('complementary')` or conversation list items.
   - Verify previous conversations are listed with newest activity first.
3. **Select and Inspect Conversation:**
   - Click on a past conversation item in the list: `page.getByRole('button', { name: /conversation|order delayed/i }).first()`.
   - Verify full message transcript (user message + assistant response) loads correctly in the chat pane.
4. **Test Search / Filter / Actions:**
   - Type a search query into the search/filter box: `page.getByRole('textbox', { name: /search/i })`.
   - Toggle pin or archive status on a conversation.

## Expected Assertions
- Conversation history lists past interactions correctly.
- Selecting a conversation loads the full transcript of user and AI messages.
- Search and filtering options work as expected.
