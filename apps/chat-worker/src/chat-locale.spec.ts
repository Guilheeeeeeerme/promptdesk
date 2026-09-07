import {
  DEFAULT_SUPPORT_LOCALE,
  SUPPORT_LOCALES,
  buildSupportPrompt,
  languageInstructionFor,
  supportLocaleOf,
} from './chat.constants';

describe('support locale handling', () => {
  it('falls back to English for missing or unknown locales', () => {
    expect(supportLocaleOf(undefined)).toBe('en-US');
    expect(supportLocaleOf('xx-XX')).toBe('en-US');
    expect(DEFAULT_SUPPORT_LOCALE).toBe('en-US');
    expect(languageInstructionFor(undefined)).toBe(
      languageInstructionFor('en-US'),
    );
  });

  it('instructs the model to reply in the user language', () => {
    for (const locale of SUPPORT_LOCALES) {
      expect(languageInstructionFor(locale)).toContain(locale);
    }
    expect(languageInstructionFor('pt-BR')).toMatch(/Brazilian Portuguese/);
    expect(languageInstructionFor('zh-CN')).toMatch(/Chinese/);
    expect(languageInstructionFor('es-ES')).toMatch(/Spanish/);
    expect(languageInstructionFor('ur-PK')).toMatch(/Urdu/);
  });

  it('appends a distinct language instruction per locale to the system prompt', () => {
    const systemInstructions = SUPPORT_LOCALES.map((locale) =>
      buildSupportPrompt({
        guidelines: null,
        history: [],
        agentRequest: 'Hello',
        knownContext: {},
        locale,
      }).systemInstruction,
    );

    expect(new Set(systemInstructions).size).toBe(SUPPORT_LOCALES.length);
    expect(systemInstructions[0]).toMatch(/Respond in English/);
    expect(systemInstructions[0]).toMatch(
      /entire reply in that language/i,
    );
  });

  it('keeps the context payload free of language instructions', () => {
    const { context } = buildSupportPrompt({
      guidelines: null,
      history: [],
      agentRequest: 'Hello',
      knownContext: {},
      locale: 'pt-BR',
    });

    expect(context).not.toMatch(/Respond in/);
  });
});
