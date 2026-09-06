/** Shared placeholder context + post-LLM substitution (guideline tokens). */

import { renderPrompt } from './prompt-registry';

export type PlaceholderValues = {
  customerName: string;
  companyName: string;
  agentName: string;
  agentEmail: string;
  date: string;
};

export type PromptMode = 'agent' | 'customer_draft';

/** Bracket keys (lowercased) → value field. Unknown keys left untouched. */
const PLACEHOLDER_ALIASES: Record<string, keyof PlaceholderValues> = {
  name: 'customerName',
  customer: 'customerName',
  'customer name': 'customerName',
  "customer's name": 'customerName',
  'client name': 'customerName',
  client: 'customerName',
  company: 'companyName',
  'company name': 'companyName',
  organisation: 'companyName',
  organization: 'companyName',
  'org name': 'companyName',
  agent: 'agentName',
  'agent name': 'agentName',
  'support agent': 'agentName',
  'agent email': 'agentEmail',
  email: 'agentEmail',
  date: 'date',
  today: 'date',
  "today's date": 'date',
  'current date': 'date',
};

/** Empty means unknown; this is intentionally not a human-facing name. */
export const UNKNOWN_CUSTOMER_NAME = '';

export function formatToday(date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Pull a display name from free-text customer message when present. */
export function inferCustomerName(text: string): string | null {
  const patterns = [
    /\b(?:my name is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
    /\b(?:this is|name[:\s]+)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export function inferCustomerEmail(text: string): string | null {
  const m = text.match(
    /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i,
  );
  return m?.[1]?.toLowerCase() ?? null;
}

export function buildPlaceholderValues(input: {
  customerName?: string | null;
  companyName?: string | null;
  agentName?: string | null;
  agentEmail?: string | null;
  date?: Date;
}): PlaceholderValues {
  return {
    customerName: input.customerName?.trim() || UNKNOWN_CUSTOMER_NAME,
    companyName: input.companyName?.trim() || 'our company',
    agentName: input.agentName?.trim() || 'Support',
    agentEmail: input.agentEmail?.trim() || '',
    date: formatToday(input.date),
  };
}

export function applyPlaceholders(
  text: string,
  values: PlaceholderValues,
): string {
  return text.replace(/\[([^\]]+)\]/g, (match, raw: string) => {
    const key = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
    const field = PLACEHOLDER_ALIASES[key];
    if (!field) return match;
    const val = values[field]?.trim();
    return val ? val : match;
  });
}

/** Prompt block: tell the model never to leave bracket tokens. */
export function buildPlaceholderPromptBlock(values: PlaceholderValues): string {
  const lines = [
    `- Company name: ${values.companyName}`,
    `- Agent name: ${values.agentName}`,
  ];
  if (values.customerName) {
    lines.splice(1, 0, `- Customer name: ${values.customerName}`);
  } else {
    lines.splice(1, 0, '- Customer name: unknown (do not invent or address them as “Customer”)');
  }
  if (values.agentEmail) {
    lines.push(`- Agent email: ${values.agentEmail}`);
  }
  lines.push(`- Today's date: ${values.date}`);
  return renderPrompt('support.placeholders.known_context', {
    known_context: lines.join('\n'),
  });
}
