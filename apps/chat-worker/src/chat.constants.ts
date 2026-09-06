import { renderPrompt } from './prompt-registry';

export const CHAT_GENERATE_QUEUE = "chat-generate";
export const GUIDELINE_VALIDATE_QUEUE = "guideline-validate";
export const CHAT_EVENTS_CHANNEL = "chat:events";

export const CHAT_ABORT_TTL_SECONDS = 60 * 30;

export function chatAbortKey(assistantMessageId: string): string {
  return `chat:abort:${assistantMessageId}`;
}

export type ChatProvider = "gemini" | "openai";

export type SupportPromptMode = "agent" | "customer_draft";

export type SupportPromptMessage = {
  role: "agent" | "copilot";
  content: string;
};

export function buildSupportPrompt(params: {
  guidelines: string | null;
  history: SupportPromptMessage[];
  agentRequest: string;
  knownContext: Record<string, string>;
  mode?: SupportPromptMode;
}): { systemInstruction: string; context: string } {
  const outputInstruction = renderPrompt(
    params.mode === "customer_draft"
      ? 'support.copilot.mode.customer_draft'
      : 'support.copilot.mode.agent',
  );

  const systemInstruction = renderPrompt('support.copilot.system', {
    mode_instruction: outputInstruction,
  });

  const payload = {
    KNOWN_CONTEXT: params.knownContext,
    COMPANY_GUIDELINES: params.guidelines?.trim() || null,
    CONVERSATION_HISTORY: params.history
      .filter((message) => message.content.trim().length > 0)
      .map((message) => ({
        speaker: message.role === "agent" ? "AGENT" : "COPILOT",
        content: message.content,
      })),
    AGENT_REQUEST: params.agentRequest,
  };

  return {
    systemInstruction,
    context: renderPrompt('support.copilot.context', {
      payload: JSON.stringify(payload),
    }),
  };
}

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
  /** Defaults to internal guidance; customer-ready copy requires explicit mode. */
  mode?: SupportPromptMode;
};

export type GuidelineValidateJobData = { companyId: string; versionId: string };

export type GuidelineValidationEvent = {
  type: "guideline_validation";
  companyId: string;
  versionId: string;
  version: number;
  status:
    | "pending"
    | "processing"
    | "valid"
    | "invalid"
    | "provider_error"
    | "cancelled";
  reason?: string | null;
  activeVersion?: number | null;
  occurredAt: string;
};

export type ChatJobEvent = {
  userId: string;
  assistantMessageId: string;
  userMessageId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  content?: string;
  error?: string;
  model?: string;
  provider?: ChatProvider;
};

export class ChatAbortedError extends Error {
  constructor(assistantMessageId: string) {
    super(`Chat generation aborted: ${assistantMessageId}`);
    this.name = "ChatAbortedError";
  }
}
