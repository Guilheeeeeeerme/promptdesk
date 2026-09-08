import type { ChatProvider } from './chat.constants';
import { LlmBudgetExceededError } from './llm-budget';

export type GuidelineModelProvider = {
  validateGuideline(content: string, model?: string): Promise<unknown>;
};

export const DEFAULT_LLM_PROVIDER_ORDER: readonly ChatProvider[] = [
  'gemini',
  'openai',
] as const;

const KNOWN_PROVIDERS: readonly ChatProvider[] = ['gemini', 'openai'];

/**
 * Resolves LLM_PROVIDER_ORDER (e.g. "openai,gemini") into an ordered provider
 * list: unknown names are ignored, duplicates collapse, and providers whose
 * key is not configured are skipped. Unset/empty input falls back to the
 * product default (Gemini first, OpenAI optional fallback).
 */
export function resolveProviderOrder(
  raw: string | undefined | null,
  configured: Partial<Record<ChatProvider, boolean>> = {},
): ChatProvider[] {
  const requested = (raw ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name): name is ChatProvider =>
      (KNOWN_PROVIDERS as readonly string[]).includes(name),
    );
  const unique = [...new Set(requested)];
  const order = unique.length > 0 ? unique : [...DEFAULT_LLM_PROVIDER_ORDER];
  return order.filter((provider) => configured[provider] !== false);
}

/**
 * Guideline validation walks providers in the resolved order; within each
 * provider, models must already be ordered cheapest to most expensive.
 * Without an explicit order this keeps the product invariant: Gemini first.
 */
export function createGeminiFirstGuidelineProvider(
  gemini: GuidelineModelProvider,
  geminiModels: string[],
  openai: GuidelineModelProvider,
  openaiModels: string[],
  openaiConfigured: boolean,
  providerOrder?: ChatProvider[],
): GuidelineModelProvider {
  const services: Record<ChatProvider, GuidelineModelProvider> = {
    gemini,
    openai,
  };
  const modelLists: Record<ChatProvider, string[]> = {
    gemini: geminiModels,
    openai: openaiModels,
  };
  const labels: Record<ChatProvider, string> = {
    gemini: 'Gemini',
    openai: 'OpenAI',
  };
  const order =
    providerOrder ??
    resolveProviderOrder(undefined, {
      gemini: true,
      openai: openaiConfigured,
    });

  return {
    async validateGuideline(content: string): Promise<unknown> {
      const failures: string[] = [];
      for (const provider of order) {
        for (const model of modelLists[provider]) {
          try {
            return await services[provider].validateGuideline(content, model);
          } catch (error) {
            // Budget halt is global for the company — do not burn further models.
            if (error instanceof LlmBudgetExceededError) throw error;
            failures.push(`${labels[provider]} ${model}: ${errorMessage(error)}`);
          }
        }
      }

      throw new Error(failures.join('; ') || 'No provider models available.');
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
