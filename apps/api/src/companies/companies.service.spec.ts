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

  it('quarantines create-with-file as pending without activating guidelines', async () => {
    const tx = {
      company: {
        create: jest.fn().mockResolvedValue({ id: 'company-new', name: 'Acme' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'company-new',
          name: 'Acme',
          createdAt: new Date('2026-09-08T00:00:00.000Z'),
          guidelineFileName: null,
          guidelineUpdatedAt: null,
          guidelineText: null,
          currentGuidelineVersion: null,
        }),
      },
      guidelineVersion: {
        create: jest.fn().mockResolvedValue({ id: 'version-1', version: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const guidelineQueue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new CompaniesService(
      prisma as never,
      {} as never,
      {} as never,
      guidelineQueue as never,
    );

    await expect(
      service.create(session, 'Acme', textFile('untrusted policy')),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'company-new',
        hasGuidelines: false,
        currentVersion: null,
        pendingVersion: 1,
        validationStatus: 'pending',
      }),
    );

    expect(tx.guidelineVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          content: 'untrusted policy',
        }),
      }),
    );
    expect(tx.company.create).toHaveBeenCalledWith({
      data: { name: 'Acme' },
    });
    expect(guidelineQueue.add).toHaveBeenCalledWith(
      'validate',
      { companyId: 'company-new', versionId: 'version-1' },
      expect.objectContaining({ jobId: 'guideline-validate-version-1' }),
    );
  });

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
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const chatPrisma = {
      chatMessage: { count: jest.fn().mockResolvedValue(0) },
    };
    const redis = {
      getClient: () => ({
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn(),
      }),
    };
    const guidelineQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const service = new CompaniesService(
      prisma as never,
      chatPrisma as never,
      redis as never,
      guidelineQueue as never,
    );
    await service.uploadGuidelines(
      session,
      'company-1',
      textFile('replacement policy'),
    );

    expect(tx.guidelineVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending' }),
      }),
    );
    expect(tx.company.update).not.toHaveBeenCalled();
    expect(guidelineQueue.add).toHaveBeenCalledWith(
      'validate',
      { companyId: 'company-1', versionId: 'version-4' },
      expect.objectContaining({ jobId: expect.not.stringContaining(':') }),
    );
  });

  it('preserves the active version when a replacement fails validation', async () => {
    const result = await (
      new CompaniesService({} as never, {} as never, {} as never) as never as {
        preserveActiveOnFailure: (
          active: unknown,
          replacement: unknown,
        ) => unknown;
      }
    ).preserveActiveOnFailure(
      { id: 'version-3', status: 'valid' },
      { id: 'version-4', status: 'invalid' },
    );

    expect(result).toEqual(
      expect.objectContaining({ id: 'version-3', status: 'valid' }),
    );
  });

  it('selects the newest valid version, ignoring pending and failed versions', async () => {
    const service = new CompaniesService(
      {} as never,
      {} as never,
      {} as never,
    ) as never as {
      selectNewestValidVersion: (
        versions: Array<{ version: number; status: string }>,
      ) => unknown;
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

  it('cancels only a pending replacement, removes its job, and publishes its status', async () => {
    const publish = jest.fn().mockResolvedValue(1);
    const remove = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      guidelineVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'version-4',
          companyId: 'company-1',
          version: 4,
          status: 'pending',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = {
      add: jest.fn(),
      getJob: jest.fn().mockResolvedValue({ remove }),
    };
    const service = new CompaniesService(
      prisma as never,
      {} as never,
      { getClient: () => ({ publish }) } as never,
      queue as never,
    ) as CompaniesService & {
      cancelGuidelineVersion: (
        session: typeof session,
        companyId: string,
        versionId: string,
      ) => Promise<{ status: string }>;
    };

    await expect(
      service.cancelGuidelineVersion(session, 'company-1', 'version-4'),
    ).resolves.toEqual(expect.objectContaining({ status: 'cancelled' }));
    expect(prisma.guidelineVersion.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'version-4',
        companyId: 'company-1',
        status: 'pending',
      },
      data: expect.objectContaining({
        status: 'cancelled',
        validationReason: 'Cancelled by user',
      }),
    });
    expect(queue.getJob).toHaveBeenCalledWith('guideline-validate-version-4');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(JSON.parse(publish.mock.calls[0][1])).toEqual(
      expect.objectContaining({
        type: 'guideline_validation',
        companyId: 'company-1',
        versionId: 'version-4',
        version: 4,
        status: 'cancelled',
      }),
    );
  });

  it('does not let an agent cancel a pending replacement', async () => {
    const updateMany = jest.fn();
    const service = new CompaniesService(
      {
        company: {
          findUnique: jest.fn().mockResolvedValue({ id: 'company-1' }),
        },
        guidelineVersion: { updateMany },
      } as never,
      {} as never,
      {} as never,
      {} as never,
    ) as CompaniesService & {
      cancelGuidelineVersion: (
        session: typeof session,
        companyId: string,
        versionId: string,
      ) => Promise<unknown>;
    };

    await expect(
      service.cancelGuidelineVersion(
        { ...session, role: 'agent' },
        'company-1',
        'version-4',
      ),
    ).rejects.toThrow('Agents cannot upload or clear company guidelines');
    expect(updateMany).not.toHaveBeenCalled();
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
