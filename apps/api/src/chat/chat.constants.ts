export const CHAT_GENERATE_QUEUE = 'chat-generate';
export const GUIDELINE_VALIDATE_QUEUE = 'guideline-validate';
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

export type GuidelineValidateJobData = { companyId: string; versionId: string };

export type GuidelineValidationEvent = {
  type: 'guideline_validation';
  companyId: string;
  versionId: string;
  version: number;
  status:
    | 'pending'
    | 'processing'
    | 'valid'
    | 'invalid'
    | 'provider_error'
    | 'cancelled';
  reason?: string | null;
  activeVersion?: number | null;
  occurredAt: string;
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

/** Serialized ChatMessage as delivered over the events channel. */
export type ChatMessageEventPayload = {
  id: string;
  conversationId: string | null;
  role: string;
  status: string;
  content: string;
  createdAt: string;
};

/** Manual human reply published by a platform admin. */
export type ChatAgentMessageEvent = {
  type: 'agent_message';
  ownerId: string;
  conversationId: string;
  message: ChatMessageEventPayload;
};

/** Status change made by the platform man in the middle. */
export type ChatConversationUpdateEvent = {
  type: 'conversation_update';
  ownerId: string;
  conversationId: string;
  status: string;
  lastMessageAt: string | null;
};

/** Anything published on CHAT_EVENTS_CHANNEL. Legacy job events omit type. */
export type ChatChannelEvent =
  | ChatAgentMessageEvent
  | ChatConversationUpdateEvent
  | GuidelineValidationEvent
  | ChatJobEvent;
