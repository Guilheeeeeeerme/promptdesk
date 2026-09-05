import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_CONVERSATION_SEARCH_LENGTH,
  isInFlightForConversation,
} from './chat.guards';

describe('chat guards', () => {
  it('recognizes only in-flight messages from the requested conversation', () => {
    expect(
      isInFlightForConversation(
        { conversationId: 'a', status: 'processing' },
        'a',
      ),
    ).toBe(true);
    expect(
      isInFlightForConversation(
        { conversationId: 'b', status: 'processing' },
        'a',
      ),
    ).toBe(false);
    expect(
      isInFlightForConversation(
        { conversationId: 'a', status: 'completed' },
        'a',
      ),
    ).toBe(false);
  });

  it('defines bounded public chat and search inputs', () => {
    expect(MAX_CHAT_MESSAGE_LENGTH).toBe(20_000);
    expect(MAX_CONVERSATION_SEARCH_LENGTH).toBe(200);
  });
});
