import {
  createGeminiFirstGuidelineProvider,
  resolveProviderOrder,
  type GuidelineModelProvider,
} from './provider-policy';

function provider(
  implementation: (content: string, model?: string) => Promise<unknown>,
): GuidelineModelProvider {
  return { validateGuideline: implementation };
}

describe('Gemini-first cheapest-model policy', () => {
  it('uses the cheapest Gemini model first and stops when it succeeds', async () => {
    const calls: string[] = [];
    const selected = createGeminiFirstGuidelineProvider(
      provider(async (_, model) => {
        calls.push(`gemini:${model}`);
        return { status: 'valid' };
      }),
      ['gemini-cheapest', 'gemini-next'],
      provider(async (_, model) => {
        calls.push(`openai:${model}`);
        return { status: 'valid' };
      }),
      ['gpt-cheapest'],
      true,
    );

    const result = await selected.validateGuideline('policy');

    expect(result).toEqual({ status: 'valid' });
    expect(calls).toEqual(['gemini:gemini-cheapest']);
  });

  it('tries the next-cheapest Gemini model before OpenAI', async () => {
    const calls: string[] = [];
    const selected = createGeminiFirstGuidelineProvider(
      provider(async (_, model) => {
        calls.push(`gemini:${model}`);
        if (model === 'gemini-cheapest') throw new Error('model unavailable');
        return { status: 'invalid' };
      }),
      ['gemini-cheapest', 'gemini-next'],
      provider(async (_, model) => {
        calls.push(`openai:${model}`);
        return { status: 'valid' };
      }),
      ['gpt-cheapest'],
      true,
    );

    const result = await selected.validateGuideline('policy');

    expect(result).toEqual({ status: 'invalid' });
    expect(calls).toEqual(['gemini:gemini-cheapest', 'gemini:gemini-next']);
  });

  it('falls back to the cheapest OpenAI model only after Gemini models fail', async () => {
    const calls: string[] = [];
    const selected = createGeminiFirstGuidelineProvider(
      provider(async (_, model) => {
        calls.push(`gemini:${model}`);
        throw new Error('Gemini unavailable');
      }),
      ['gemini-cheapest', 'gemini-next'],
      provider(async (_, model) => {
        calls.push(`openai:${model}`);
        if (model === 'gpt-cheapest') throw new Error('model unavailable');
        return { status: 'valid' };
      }),
      ['gpt-cheapest', 'gpt-next'],
      true,
    );

    const result = await selected.validateGuideline('policy');

    expect(result).toEqual({ status: 'valid' });
    expect(calls).toEqual([
      'gemini:gemini-cheapest',
      'gemini:gemini-next',
      'openai:gpt-cheapest',
      'openai:gpt-next',
    ]);
  });

  it('does not call OpenAI when it is unconfigured', async () => {
    const calls: string[] = [];
    const selected = createGeminiFirstGuidelineProvider(
      provider(async (_, model) => {
        calls.push(`gemini:${model}`);
        throw new Error('Gemini unavailable');
      }),
      ['gemini-cheapest'],
      provider(async (_, model) => {
        calls.push(`openai:${model}`);
        return { status: 'valid' };
      }),
      ['gpt-cheapest'],
      false,
    );

    await expect(selected.validateGuideline('policy')).rejects.toThrow(
      /Gemini unavailable/,
    );
    expect(calls).toEqual(['gemini:gemini-cheapest']);
  });

  it('halts provider failover when the company LLM budget is exceeded', async () => {
    const { LlmBudgetExceededError } = await import('./llm-budget');
    const calls: string[] = [];
    const selected = createGeminiFirstGuidelineProvider(
      provider(async (_, model) => {
        calls.push(`gemini:${model}`);
        throw new LlmBudgetExceededError('budget_exceeded', 'company-1');
      }),
      ['gemini-cheapest', 'gemini-next'],
      provider(async (_, model) => {
        calls.push(`openai:${model}`);
        return { status: 'valid' };
      }),
      ['gpt-cheapest'],
      true,
    );

    await expect(selected.validateGuideline('policy')).rejects.toBeInstanceOf(
      LlmBudgetExceededError,
    );
    expect(calls).toEqual(['gemini:gemini-cheapest']);
  });

});

describe('resolveProviderOrder', () => {
  it('defaults to gemini first, openai fallback', () => {
    expect(resolveProviderOrder(undefined, { gemini: true, openai: true })).toEqual(
      ['gemini', 'openai'],
    );
    expect(resolveProviderOrder(null, { gemini: true, openai: true })).toEqual(
      ['gemini', 'openai'],
    );
    expect(resolveProviderOrder('', { gemini: true, openai: true })).toEqual([
      'gemini',
      'openai',
    ]);
  });

  it('ignores unknown provider names', () => {
    expect(
      resolveProviderOrder('anthropic,gemini,bogus', {
        gemini: true,
        openai: true,
      }),
    ).toEqual(['gemini']);
    // Unknown names only → falls back to the default order.
    expect(
      resolveProviderOrder('anthropic,bogus', { gemini: true, openai: true }),
    ).toEqual(['gemini', 'openai']);
  });

  it('skips providers whose key is not configured', () => {
    expect(
      resolveProviderOrder('gemini,openai', { gemini: true, openai: false }),
    ).toEqual(['gemini']);
  });

  it('honors a reordered openai-first order', () => {
    expect(
      resolveProviderOrder('openai,gemini', { gemini: true, openai: true }),
    ).toEqual(['openai', 'gemini']);
  });

  it('trims whitespace, lowercases, and deduplicates', () => {
    expect(
      resolveProviderOrder(' OpenAI , gemini, openai ', {
        gemini: true,
        openai: true,
      }),
    ).toEqual(['openai', 'gemini']);
  });
});

describe('ordered guideline provider', () => {
  it('tries OpenAI first when the resolved order puts it first', async () => {
    const calls: string[] = [];
    const selected = createGeminiFirstGuidelineProvider(
      provider(async (_, model) => {
        calls.push(`gemini:${model}`);
        return { status: 'valid' };
      }),
      ['gemini-cheapest'],
      provider(async (_, model) => {
        calls.push(`openai:${model}`);
        return { status: 'valid' };
      }),
      ['gpt-cheapest'],
      true,
      ['openai', 'gemini'],
    );

    const result = await selected.validateGuideline('policy');

    expect(result).toEqual({ status: 'valid' });
    expect(calls).toEqual(['openai:gpt-cheapest']);
  });
});
