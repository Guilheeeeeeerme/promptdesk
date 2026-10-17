import type { ChatProvider } from './chat.constants';
import { LlmBudgetExceededError } from './llm-budget';

export type GuidelineModelProvider = {
  validateGuideline(content: string, model?: string): Promise<unknown>;
};

/**
 * Generation is Gemini only. JEV owns closed decisions. The raw argument is
 * ignored so a leftover LLM_PROVIDER_ORDER value cannot add another provider.
 */
export function resolveProviderOrder(
  _raw?: string | null,
  configured: Partial<Record<ChatProvider, boolean>> = {},
): ChatProvider[] {
  if (configured.gemini === false) return [];
  return ['gemini'];
}

/**
 * Guideline validation calls the pinned Gemini model once. JEV owns the
 * closed decision when `JEV_GUIDELINE_MODE=active`. There is no model ladder.
 */
export function createGeminiGuidelineProvider(
  gemini: GuidelineModelProvider,
  model: string,
): GuidelineModelProvider {
  return {
    async validateGuideline(content: string): Promise<unknown> {
      try {
        return await gemini.validateGuideline(content, model);
      } catch (error) {
        if (error instanceof LlmBudgetExceededError) throw error;
        throw new Error(`Gemini ${model}: ${errorMessage(error)}`);
      }
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
