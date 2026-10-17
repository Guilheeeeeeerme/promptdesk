import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type JevMode = 'off' | 'shadow' | 'active';

export const JEV_INPUT_USD_PER_MILLION = 0.042;
export const DEFAULT_JEV_MODEL = 'jev-1.13.0';
export const DEFAULT_JEV_BASE_URL = 'https://api.typesafe.ai';

export type JevChoiceQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string | null>;
};

export type JevChoiceAnswer = {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type JevCallMeta = {
  provider: 'jev';
  mode: JevMode;
  requestedModel: string;
  returnedModel: string | null;
  durationMs: number;
  inputTokens: number | null;
  estimatedUsd: number | null;
};

export type JevDecision = {
  answers: Record<string, JevChoiceAnswer>;
  meta: JevCallMeta;
};

export function parseJevMode(raw: string | undefined | null, hasKey: boolean): JevMode {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return hasKey ? 'active' : 'off';
  if (value === 'off' || value === 'shadow' || value === 'active') return value;
  throw new Error(`invalid JEV mode "${value}" (expected off | shadow | active)`);
}

/**
 * Direct TypeSafe System One client — never via Headroom.
 * Closed Choice judgments only (PromptDesk guideline validation).
 */
@Injectable()
export class JevService {
  private readonly logger = new Logger(JevService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  guidelineMode: JevMode;

  constructor(private readonly config: ConfigService) {
    this.apiKey = (this.config.get<string>('JEV_API_KEY') ?? '').trim();
    const rawBase =
      (this.config.get<string>('JEV_BASE_URL') ?? DEFAULT_JEV_BASE_URL).replace(/\/+$/, '');
    this.baseUrl = rawBase;
    this.model = this.config.get<string>('JEV_MODEL') ?? DEFAULT_JEV_MODEL;
    this.timeoutMs = Number(this.config.get<string>('JEV_TIMEOUT_SECONDS') ?? 10) * 1000;
    // Empty mode → active with key, off without. Explicit active/shadow without
    // a key logs and falls back to off so chat-worker still boots (operator
    // must fix panel env); decideChoice still refuses without a key.
    let mode: JevMode = 'off';
    try {
      mode = parseJevMode(
        this.config.get<string>('JEV_GUIDELINE_MODE'),
        Boolean(this.apiKey),
      );
    } catch (err) {
      this.logger.error(String(err));
      mode = 'off';
    }
    if ((mode === 'shadow' || mode === 'active') && !this.apiKey) {
      this.logger.error(
        'jev_key_missing:guideline — set JEV_API_KEY or set JEV_GUIDELINE_MODE=off; forcing off',
      );
      mode = 'off';
    }
    this.guidelineMode = mode;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async decideChoice(
    state: unknown,
    questions: Record<string, JevChoiceQuestion>,
    mode: JevMode = this.guidelineMode,
  ): Promise<JevDecision> {
    if (mode === 'off') {
      throw new Error('jev_off: guideline mode is off');
    }
    if (!this.apiKey) {
      throw new Error('jev_unavailable: JEV_API_KEY not set');
    }
    const started = Date.now();
    const url = `${this.baseUrl}/v1/systemone`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, state, questions }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      // Never log response body (may echo state).
      throw new Error(`JEV ${res.status}: upstream error`);
    }
    const data = (await res.json()) as {
      model?: unknown;
      answers?: unknown;
      usage?: { input_tokens?: number };
    };
    const answers = this.parseAnswers(questions, data.answers);
    const inputTokens =
      typeof data.usage?.input_tokens === 'number' ? data.usage.input_tokens : null;
    const estimatedUsd =
      inputTokens == null ? null : (inputTokens / 1_000_000) * JEV_INPUT_USD_PER_MILLION;
    return {
      answers,
      meta: {
        provider: 'jev',
        mode,
        requestedModel: this.model,
        returnedModel: typeof data.model === 'string' ? data.model : null,
        durationMs: Date.now() - started,
        inputTokens,
        estimatedUsd,
      },
    };
  }

  logShadowCompare(fields: Record<string, unknown>): void {
    this.logger.log({ event: 'jev_shadow', ...fields });
  }

  logShadowError(fields: Record<string, unknown>): void {
    this.logger.warn({ event: 'jev_shadow_error', ...fields });
  }

  private parseAnswers(
    questions: Record<string, JevChoiceQuestion>,
    raw: unknown,
  ): Record<string, JevChoiceAnswer> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('jev answers: not an object');
    }
    const out: Record<string, JevChoiceAnswer> = {};
    for (const id of Object.keys(questions)) {
      const q = questions[id]!;
      const a = (raw as Record<string, unknown>)[id];
      if (!a || typeof a !== 'object') throw new Error(`jev answers: missing ${id}`);
      const rec = a as Record<string, unknown>;
      if (rec.type !== 'choice') throw new Error(`jev answers: type mismatch ${id}`);
      const options = new Set(Object.keys(q.criteria));
      if (typeof rec.choice !== 'string' || !options.has(rec.choice)) {
        throw new Error(`jev answers: choice not in options ${id}`);
      }
      const confidence = Number(rec.confidence);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        throw new Error(`jev answers: confidence out of range ${id}`);
      }
      const probabilities = rec.probabilities;
      if (!probabilities || typeof probabilities !== 'object') {
        throw new Error(`jev answers: probabilities missing ${id}`);
      }
      out[id] = {
        type: 'choice',
        choice: rec.choice,
        probabilities: probabilities as Record<string, number>,
        confidence,
      };
    }
    return out;
  }
}
