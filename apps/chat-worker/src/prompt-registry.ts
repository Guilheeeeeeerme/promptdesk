import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

export type PromptKind =
  | 'system_instruction'
  | 'user_template'
  | 'context_template';

export type PromptDefinition = {
  id: string;
  kind: PromptKind;
  purpose: string;
  when: string;
  audience: string;
  variables: string[];
  security: string[];
  output_contract: string;
  template: string;
};

type PromptRegistryDocument = {
  version: number;
  prompts: PromptDefinition[];
};

let cachedRegistry: Map<string, PromptDefinition> | undefined;

function registryPath(): string {
  const candidates = [
    resolve(__dirname, '..', 'prompts', 'registry.yml'),
    resolve(process.cwd(), 'prompts', 'registry.yml'),
    resolve(process.cwd(), 'apps', 'chat-worker', 'prompts', 'registry.yml'),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(`Prompt registry not found. Tried: ${candidates.join(', ')}`);
  }
  return path;
}

function parseRegistry(): Map<string, PromptDefinition> {
  const document = yaml.load(readFileSync(registryPath(), 'utf8')) as Partial<PromptRegistryDocument>;
  if (document.version !== 1 || !Array.isArray(document.prompts)) {
    throw new Error('Prompt registry must declare version 1 and a prompts list.');
  }

  const definitions = document.prompts.map((prompt) => {
    if (
      !prompt ||
      typeof prompt.id !== 'string' ||
      typeof prompt.kind !== 'string' ||
      typeof prompt.template !== 'string' ||
      typeof prompt.purpose !== 'string' ||
      typeof prompt.when !== 'string' ||
      typeof prompt.audience !== 'string' ||
      !Array.isArray(prompt.variables) ||
      !Array.isArray(prompt.security) ||
      typeof prompt.output_contract !== 'string'
    ) {
      throw new Error('Every prompt registry entry needs complete metadata.');
    }
    return prompt;
  });

  const ids = new Set<string>();
  const registry = new Map<string, PromptDefinition>();
  for (const prompt of definitions) {
    if (ids.has(prompt.id)) throw new Error(`Duplicate prompt id: ${prompt.id}`);
    ids.add(prompt.id);
    registry.set(prompt.id, prompt);
  }
  return registry;
}

function registry(): Map<string, PromptDefinition> {
  cachedRegistry ??= parseRegistry();
  return cachedRegistry;
}

export function getPromptDefinition(id: string): PromptDefinition {
  const prompt = registry().get(id);
  if (!prompt) throw new Error(`Unknown prompt id: ${id}`);
  return prompt;
}

export function renderPrompt(
  id: string,
  variables: Record<string, string> = {},
): string {
  const prompt = getPromptDefinition(id);
  const declared = new Set(prompt.variables);
  return prompt.template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, name: string) => {
    if (!declared.has(name)) {
      throw new Error(`Prompt ${id} uses undeclared variable: ${name}`);
    }
    if (!(name in variables)) {
      throw new Error(`Prompt ${id} is missing variable: ${name}`);
    }
    return variables[name];
  });
}

export function listPromptDefinitions(): PromptDefinition[] {
  return [...registry().values()];
}
