export const MAX_CHAT_MESSAGE_LENGTH = 20_000;
export const MAX_CONVERSATION_SEARCH_LENGTH = 200;

export function isInFlightForConversation(
  message: { conversationId: string | null; status: string },
  conversationId: string,
): boolean {
  return (
    message.conversationId === conversationId &&
    (message.status === 'pending' || message.status === 'processing')
  );
}
