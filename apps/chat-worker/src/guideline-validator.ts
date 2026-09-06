export type GuidelineValidationStatus =
  | 'pending'
  | 'valid'
  | 'invalid'
  | 'malicious'
  | 'provider_error';

export type GuidelineValidationResult = {
  status: GuidelineValidationStatus;
  reason?: string;
};

export interface GuidelineValidationProvider {
  validateGuideline(content: string): Promise<unknown>;
}

const MAX_GUIDELINE_BYTES = 10 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 30_000;

// These checks are deliberately deterministic and conservative. Model
// validation is advisory and must never turn a locally unsafe upload valid.
const MALICIOUS_GUIDELINE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|system)\s+instructions?\b/i, 'prompt injection'],
  [/\b(reveal| disclose|dump|print|show)\s+(the\s+)?(system\s+prompt|secrets?|credentials?|api\s*keys?|passwords?)\b/i, 'secret or prompt exfiltration'],
  [/<\/?script\b|javascript:|data:text\/html|on(load|error|click)\s*=/i, 'executable script'],
  [/\b(webhook|attacker\.|exfiltrat|curl\s+https?:|send\s+.*\b(secrets?|credentials?|api\s*keys?)\b)/i, 'data exfiltration'],
  [/\b(tracking\s+pixel|tracking\s+beacon|utm_[a-z]+|analytics\s+script)\b/i, 'tracking content'],
  [/\b(bypass|disable|skip|override)\s+(safety|security|authentication|approval|verification|authorization|fraud)\b/i, 'unsafe policy bypass'],
];

export class GuidelineValidator {
  constructor(
    private readonly provider: GuidelineValidationProvider,
    private readonly timeoutMs = PROVIDER_TIMEOUT_MS,
  ) {}

  static pending(): GuidelineValidationResult {
    return { status: 'pending' };
  }

  async validate(input: { content: string }): Promise<GuidelineValidationResult> {
    const content = input.content;
    if (!content.trim()) {
      return { status: 'invalid', reason: 'Guideline text is empty.' };
    }
    if (Buffer.byteLength(content, 'utf8') > MAX_GUIDELINE_BYTES) {
      return { status: 'invalid', reason: 'Guideline text exceeds the 10 MiB limit.' };
    }

    const deterministic = this.screen(content);
    if (deterministic) return deterministic;

    let response: unknown;
    try {
      response = await this.withTimeout(this.provider.validateGuideline(content));
    } catch (error) {
      return {
        status: 'provider_error',
        reason: error instanceof Error ? error.message : 'Guideline provider failed.',
      };
    }

    return this.parseProviderResult(response);
  }

  private screen(content: string): GuidelineValidationResult | null {
    for (const [pattern, reason] of MALICIOUS_GUIDELINE_PATTERNS) {
      if (pattern.test(content)) return { status: 'malicious', reason };
    }
    return null;
  }

  private parseProviderResult(response: unknown): GuidelineValidationResult {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return { status: 'provider_error', reason: 'Provider returned an invalid result.' };
    }
    const status = (response as { status?: unknown }).status;
    if (status !== 'valid' && status !== 'invalid' && status !== 'malicious') {
      return { status: 'provider_error', reason: 'Provider returned an unknown status.' };
    }
    const reason = (response as { reason?: unknown }).reason;
    return typeof reason === 'string' ? { status, reason } : { status };
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Guideline provider timed out.')), this.timeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
