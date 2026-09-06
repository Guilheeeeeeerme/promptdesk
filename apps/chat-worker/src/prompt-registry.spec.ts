import {
  getPromptDefinition,
  listPromptDefinitions,
  renderPrompt,
} from './prompt-registry';

describe('prompt registry', () => {
  it('loads documented prompt definitions with metadata', () => {
    const prompts = listPromptDefinitions();

    expect(prompts.length).toBeGreaterThanOrEqual(7);
    for (const prompt of prompts) {
      expect(prompt.id).toEqual(expect.any(String));
      expect(prompt.purpose).toEqual(expect.any(String));
      expect(prompt.when).toEqual(expect.any(String));
      expect(prompt.audience).toEqual(expect.any(String));
      expect(prompt.output_contract).toEqual(expect.any(String));
      expect(prompt.security.length).toBeGreaterThan(0);
    }
  });

  it('renders declared variables and rejects missing variables', () => {
    expect(
      renderPrompt('support.copilot.mode.agent'),
    ).toMatch(/internal guidance/i);
    expect(() => renderPrompt('support.copilot.system')).toThrow(
      /missing variable: mode_instruction/i,
    );
    expect(getPromptDefinition('support.copilot.context').kind).toBe(
      'context_template',
    );
  });
});
