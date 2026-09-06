jest.mock('../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));
jest.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
}));
import { CompaniesService } from './companies.service';

describe('CompaniesService safe guideline lifecycle', () => {
  const session = {
    userId: 'admin-1',
    role: 'admin' as const,
    activeCompanyId: 'company-1',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };

  it('quarantines an upload as pending without replacing the active version', async () => {
    const tx = {
      guidelineVersion: {
        findFirst: jest.fn().mockResolvedValue({ version: 3 }),
        create: jest.fn().mockResolvedValue({ id: 'version-4', version: 4 }),
      },
      company: {
        update: jest.fn(),
      },
    };
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const chatPrisma = { chatMessage: { count: jest.fn().mockResolvedValue(0) } };
    const redis = { getClient: () => ({ incr: jest.fn().mockResolvedValue(1), expire: jest.fn() }) };

    const service = new CompaniesService(prisma as never, chatPrisma as never, redis as never);
    await service.uploadGuidelines(session, 'company-1', textFile('replacement policy'));

    expect(tx.guidelineVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pending' }) }),
    );
    expect(tx.company.update).not.toHaveBeenCalled();
  });

  it('preserves the active version when a replacement fails validation', async () => {
    const result = await (new CompaniesService({} as never, {} as never, {} as never) as never as {
      preserveActiveOnFailure: (active: unknown, replacement: unknown) => unknown;
    }).preserveActiveOnFailure(
      { id: 'version-3', status: 'valid' },
      { id: 'version-4', status: 'invalid' },
    );

    expect(result).toEqual(expect.objectContaining({ id: 'version-3', status: 'valid' }));
  });

  it('selects the newest valid version, ignoring pending and failed versions', async () => {
    const service = new CompaniesService({} as never, {} as never, {} as never) as never as {
      selectNewestValidVersion: (versions: Array<{ version: number; status: string }>) => unknown;
    };

    expect(
      service.selectNewestValidVersion([
        { version: 2, status: 'valid' },
        { version: 3, status: 'provider_error' },
        { version: 4, status: 'pending' },
        { version: 5, status: 'invalid' },
        { version: 1, status: 'valid' },
      ]),
    ).toEqual(expect.objectContaining({ version: 2, status: 'valid' }));
  });
});

function textFile(content: string): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'guidelines.txt',
    encoding: '7bit',
    mimetype: 'text/plain',
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content),
    destination: '',
    filename: 'guidelines.txt',
    path: '',
    stream: undefined as never,
  };
}
