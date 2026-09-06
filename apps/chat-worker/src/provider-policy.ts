export type GuidelineModelProvider = {
  validateGuideline(content: string, model?: string): Promise<unknown>;
};

/**
 * Provider order is a product invariant: Gemini is always tried first.
 * Each provider's models must already be ordered cheapest to most expensive.
 */
export function createGeminiFirstGuidelineProvider(
  gemini: GuidelineModelProvider,
  geminiModels: string[],
  openai: GuidelineModelProvider,
  openaiModels: string[],
  openaiConfigured: boolean,
): GuidelineModelProvider {
  return {
    async validateGuideline(content: string): Promise<unknown> {
      const failures: string[] = [];
      for (const model of geminiModels) {
        try {
          return await gemini.validateGuideline(content, model);
        } catch (error) {
          failures.push(`Gemini ${model}: ${errorMessage(error)}`);
        }
      }

      if (openaiConfigured) {
        for (const model of openaiModels) {
          try {
            return await openai.validateGuideline(content, model);
          } catch (error) {
            failures.push(`OpenAI ${model}: ${errorMessage(error)}`);
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
