import {
  DEFAULT_LLM_DAILY_BUDGET,
  DEFAULT_LLM_RATE_LIMIT_PER_MINUTE,
  LLM_BUDGET_EXCEEDED,
  LLM_RATE_LIMITED,
  LlmBudgetExceededError,
  LlmBudgetService,
} from './llm-budget';

type RedisStub = {
  incr: jest.Mock;
  expire: jest.Mock;
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

let mockRedis: RedisStub;

function configOf(values: Record<string, string | number> = {}) {
  return {
    get: (key: string, fallback?: string | number) =>
      key in values ? values[key] : fallback,
  };
}

describe('LlmBudgetService', () => {
  beforeEach(() => {
    mockRedis = {
      incr: jest.fn(),
      expire: jest.fn().mockResolvedValue(1),
    };
  });

  it('allows calls under the per-minute and daily caps', async () => {
    mockRedis.incr
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    const service = new LlmBudgetService(configOf() as never);

    await expect(service.checkAllowance('company-1')).resolves.toBeNull();
    expect(mockRedis.expire).toHaveBeenCalledTimes(2);
  });

  it('halts when the per-minute rate limit is exceeded', async () => {
    mockRedis.incr.mockResolvedValueOnce(DEFAULT_LLM_RATE_LIMIT_PER_MINUTE + 1);
    const service = new LlmBudgetService(configOf() as never);

    await expect(service.checkAllowance('company-1')).resolves.toBe(
      LLM_RATE_LIMITED,
    );
    await expect(service.assertAllowed('company-1')).rejects.toEqual(
      expect.objectContaining({
        name: 'LlmBudgetExceededError',
        reason: LLM_RATE_LIMITED,
        companyId: 'company-1',
      }),
    );
  });

  it('halts when the daily budget is exceeded', async () => {
    mockRedis.incr
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(DEFAULT_LLM_DAILY_BUDGET + 1);
    const service = new LlmBudgetService(
      configOf({
        LLM_RATE_LIMIT_PER_MINUTE: 100,
        LLM_DAILY_BUDGET: DEFAULT_LLM_DAILY_BUDGET,
      }) as never,
    );

    await expect(service.assertAllowed('company-2')).rejects.toBeInstanceOf(
      LlmBudgetExceededError,
    );
    try {
      await service.assertAllowed('company-2');
    } catch (err) {
      expect(err).toMatchObject({
        reason: LLM_BUDGET_EXCEEDED,
        companyId: 'company-2',
      });
    }
  });

  it('fails closed when Redis is unavailable', async () => {
    mockRedis.incr.mockRejectedValueOnce(new Error('redis down'));
    const service = new LlmBudgetService(configOf() as never);

    await expect(service.checkAllowance('company-1')).resolves.toBe(
      LLM_BUDGET_EXCEEDED,
    );
  });
});
