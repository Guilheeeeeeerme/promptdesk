/**
 * Output-side policy screen (OWASP LLM10).
 *
 * Model output is untrusted input. A reply is persisted, pushed over the
 * events channel, and read by a support agent who may paste it to a customer,
 * so a covert tracking pixel or exfiltration link in the reply is a live
 * channel out of the tenant. These patterns mirror the deterministic guideline
 * screen in guideline-validator.ts, restricted to the output-side classes.
 */

export type OutputPolicy = { id: string; pattern: RegExp };

export const OUTPUT_POLICIES: readonly OutputPolicy[] = [
  {
    id: 'script-exec',
    pattern: /<\/?script\b|javascript:|data:text\/html|on(load|error|click)\s*=/i,
  },
  {
    id: 'data-exfil',
    pattern:
      /\b(webhook\.site|pastebin\.com|requestbin\w*|ngrok\.(io|dev|app)|pipedream\.net|burpcollaborator\.net|exfiltrat\w*)\b|\bcurl\s+https?:/i,
  },
  {
    id: 'tracking',
    pattern: /\btracking\s+(pixel|beacon)\b|\butm_[a-z]+\s*=|\b(pixel|beacon)\.(gif|png|js)\b/i,
  },
];

export class OutputPolicyError extends Error {
  constructor(readonly policyId: string) {
    super(`Model output blocked by policy: ${policyId}`);
    this.name = 'OutputPolicyError';
  }
}

/** Throw when generated text carries a script, exfiltration, or tracking payload. */
export function screenModelOutput(text: string): void {
  if (!text) return;
  for (const policy of OUTPUT_POLICIES) {
    if (policy.pattern.test(text)) {
      throw new OutputPolicyError(policy.id);
    }
  }
}
