export const CHAT_GENERATE_QUEUE = 'chat-generate';
export const CHAT_EVENTS_CHANNEL = 'chat:events';

export const CHAT_ABORT_TTL_SECONDS = 60 * 30;

export function chatAbortKey(assistantMessageId: string): string {
  return `chat:abort:${assistantMessageId}`;
}

export type ChatProvider = 'gemini' | 'openai';

export type ChatGenerateJobData = {
  assistantMessageId: string;
  userMessageId: string;
  companyId: string;
  userId: string;
  /** Owning conversation; legacy jobs (pre-conversations) omit it. */
  conversationId?: string;
  /** Primary Gemini; failover re-enqueues with openai. */
  provider?: ChatProvider;
  /** Attempts already spent on prior provider(s) before this job. */
  priorAttemptCount?: number;
};

export type ChatJobEvent = {
  userId: string;
  assistantMessageId: string;
  userMessageId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  content?: string;
  error?: string;
  model?: string;
  provider?: ChatProvider;
};

export class ChatAbortedError extends Error {
  constructor(assistantMessageId: string) {
    super(`Chat generation aborted: ${assistantMessageId}`);
    this.name = 'ChatAbortedError';
  }
}
