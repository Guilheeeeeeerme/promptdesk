export const MAX_GUIDELINE_PROMPT_CHARS = 120_000;
export const MAX_HISTORY_MESSAGE_CHARS = 8_000;
export const MAX_HISTORY_TOTAL_CHARS = 60_000;
export const MAX_USER_MESSAGE_CHARS = 20_000;

type PromptMessage = { role: 'user' | 'assistant'; content: string };

export function boundPromptContext(input: {
  guidelines: string | null;
  history: PromptMessage[];
  userMessage: string;
}): {
  guidelines: string;
  history: PromptMessage[];
  userMessage: string;
  truncated: boolean;
} {
  let truncated = false;
  const guidelines = input.guidelines ?? '';
  const boundedGuidelines = guidelines.slice(0, MAX_GUIDELINE_PROMPT_CHARS);
  truncated ||= boundedGuidelines.length !== guidelines.length;

  const boundedHistory: PromptMessage[] = [];
  let totalHistoryChars = 0;
  for (const message of input.history) {
    if (totalHistoryChars >= MAX_HISTORY_TOTAL_CHARS) {
      truncated = true;
      break;
    }
    const content = message.content.slice(
      0,
      Math.min(
        MAX_HISTORY_MESSAGE_CHARS,
        MAX_HISTORY_TOTAL_CHARS - totalHistoryChars,
      ),
    );
    truncated ||= content.length !== message.content.length;
    boundedHistory.push({ ...message, content });
    totalHistoryChars += content.length;
  }

  const userMessage = input.userMessage.slice(0, MAX_USER_MESSAGE_CHARS);
  truncated ||= userMessage.length !== input.userMessage.length;

  return {
    guidelines: boundedGuidelines,
    history: boundedHistory,
    userMessage,
    truncated,
  };
}
