export const CHAT_GENERATE_QUEUE = 'chat-generate';
export const CHAT_EVENTS_CHANNEL = 'chat:events';

/** Redis abort flag TTL (seconds). Covers long LLM calls + retries. */
export const CHAT_ABORT_TTL_SECONDS = 60 * 30;

/** Idempotent-send record TTL (seconds): replays resolve within 24h. */
export const CHAT_IDEM_TTL_SECONDS = 60 * 60 * 24;

/** Claim marker stored while the idempotent send is still processing. */
export const CHAT_IDEM_PENDING = 'pending';

/** Rate limit window: fixed 1-minute buckets per (companyId, userId). */
export const CHAT_RATE_LIMIT_WINDOW_SECONDS = 60;

export function chatAbortKey(assistantMessageId: string): string {
  return `chat:abort:${assistantMessageId}`;
}

export function chatIdemKey(
  companyId: string,
  userId: string,
  idempotencyKey: string,
): string {
  return `chat:idem:${companyId}:${userId}:${idempotencyKey}`;
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
