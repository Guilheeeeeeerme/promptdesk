export type GuidelineValidationStatus = 'valid' | 'invalid' | 'provider_error';

export interface GuidelineValidationResult {
  status: GuidelineValidationStatus;
  reason?: string;
}

export interface GuidelineValidationProvider {
  validateGuideline(input: { content: string }): Promise<unknown>;
}

const MAX_GUIDELINE_CHARS = 10 * 1024 * 1024;
const DANGEROUS_PATTERNS = [
  /ignore\s+(all\s+)?previous|override\s+(the\s+)?system/i,
  /reveal|dump|exfiltrat(e|ion).{0,40}(secret|prompt|token|password)/i,
  /<script\b|javascript:|onerror\s*=/i,
  /tracking\s*(pixel|beacon)|send\s+.*to\s+https?:/i,
  /bypass\s+.*(verification|policy|approval)|skip\s+.*(security|safety)/i,
];

export class GuidelineValidator {
  constructor(private readonly provider: GuidelineValidationProvider) {}

  static pending() {
    return { status: 'pending' as const };
  }

  async validate(input: { content: string }): Promise<GuidelineValidationResult> {
    const content = input.content.trim();
    if (!content) return { status: 'invalid', reason: 'Guideline is empty' };
    if (content.length > MAX_GUIDELINE_CHARS) {
      return { status: 'invalid', reason: 'Guideline is too large' };
    }
    if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(content))) {
      return { status: 'invalid', reason: 'Guideline contains unsafe instructions' };
    }
    try {
      const raw = await this.provider.validateGuideline({ content });
      const status = typeof raw === 'object' && raw !== null && 'status' in raw
        ? (raw as { status?: unknown }).status
        : undefined;
      if (status === 'valid') return { status: 'valid' };
      if (status === 'invalid') return { status: 'invalid', reason: 'AI validator rejected guideline' };
      return { status: 'provider_error', reason: 'AI validator returned an invalid result' };
    } catch {
      return { status: 'provider_error', reason: 'AI validator unavailable' };
    }
  }
}
