import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const LLM_RATE_LIMITED = 'rate_limit';
export const LLM_BUDGET_EXCEEDED = 'budget_exceeded';

const RATE_LIMIT_TTL_SECONDS = 120;
const BUDGET_TTL_SECONDS = 172_800;

/** Default staging-strict worker budgets (docs/guardrails.md). */
export const DEFAULT_LLM_RATE_LIMIT_PER_MINUTE = 20;
export const DEFAULT_LLM_DAILY_BUDGET = 500;

export class LlmBudgetExceededError extends Error {
  constructor(
    readonly reason: typeof LLM_RATE_LIMITED | typeof LLM_BUDGET_EXCEEDED,
    readonly companyId: string,
  ) {
    super(
      reason === LLM_RATE_LIMITED
        ? `LLM rate limit exceeded for company ${companyId}`
        : `LLM daily budget exceeded for company ${companyId}`,
    );
    this.name = 'LlmBudgetExceededError';
  }
}

/**
 * Worker-side Redis fixed-window call budgets per company.
 * Counts every request that is about to reach a provider; fails closed.
 */
@Injectable()
export class LlmBudgetService {
  private readonly logger = new Logger(LlmBudgetService.name);
  private readonly redis: Redis;
  private readonly rateLimitPerMinute: number;
  private readonly dailyBudget: number;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.rateLimitPerMinute = Number(
      this.config.get(
        'LLM_RATE_LIMIT_PER_MINUTE',
        DEFAULT_LLM_RATE_LIMIT_PER_MINUTE,
      ),
    );
    this.dailyBudget = Number(
      this.config.get('LLM_DAILY_BUDGET', DEFAULT_LLM_DAILY_BUDGET),
    );
  }

  /**
   * INCR per-company minute + day counters. Returns a denial reason or null
   * when the call is allowed. On Redis failure, fail closed (deny).
   */
  async checkAllowance(
    companyId: string,
  ): Promise<typeof LLM_RATE_LIMITED | typeof LLM_BUDGET_EXCEEDED | null> {
    try {
      const minuteBucket = Math.floor(Date.now() / 60_000);
      const rateKey = `llm:rate:${companyId}:${minuteBucket}`;
      const rateCount = await this.redis.incr(rateKey);
      if (rateCount === 1) {
        await this.redis.expire(rateKey, RATE_LIMIT_TTL_SECONDS);
      }
      if (rateCount > this.rateLimitPerMinute) {
        return LLM_RATE_LIMITED;
      }

      const dayBucket = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const budgetKey = `llm:budget:${companyId}:${dayBucket}`;
      const budgetCount = await this.redis.incr(budgetKey);
      if (budgetCount === 1) {
        await this.redis.expire(budgetKey, BUDGET_TTL_SECONDS);
      }
      if (budgetCount > this.dailyBudget) {
        return LLM_BUDGET_EXCEEDED;
      }

      return null;
    } catch (err) {
      this.logger.warn(
        `LLM budget check failed closed for ${companyId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return LLM_BUDGET_EXCEEDED;
    }
  }

  /** Throw when the company is over budget; call before any provider invoke. */
  async assertAllowed(companyId: string): Promise<void> {
    const reason = await this.checkAllowance(companyId);
    if (reason) {
      throw new LlmBudgetExceededError(reason, companyId);
    }
  }
}
