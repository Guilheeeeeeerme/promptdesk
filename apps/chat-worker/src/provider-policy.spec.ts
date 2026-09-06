import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createGeminiFirstGuidelineProvider,
  type GuidelineModelProvider,
} from './provider-policy.ts';

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

    assert.deepEqual(result, { status: 'valid' });
    assert.deepEqual(calls, ['gemini:gemini-cheapest']);
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

    assert.deepEqual(result, { status: 'invalid' });
    assert.deepEqual(calls, ['gemini:gemini-cheapest', 'gemini:gemini-next']);
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

    assert.deepEqual(result, { status: 'valid' });
    assert.deepEqual(calls, [
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

    await assert.rejects(
      selected.validateGuideline('policy'),
      /Gemini unavailable/,
    );
    assert.deepEqual(calls, ['gemini:gemini-cheapest']);
  });

});
