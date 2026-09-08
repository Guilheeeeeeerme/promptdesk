import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { validate, ValidationError } from 'class-validator';
jest.mock('./session.service', () => ({
  SessionService: class SessionService {},
}));
jest.mock('../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { SessionData } from './session.types';

describe('AuthService.register', () => {
  const companyId = 'company-1';
  const userId = 'user-1';
  const registeredUser = {
    id: userId,
    email: 'owner@example.com',
    name: 'Owner',
    passwordHash: 'hashed-password',
    role: Role.owner,
    locale: null,
    companyId,
    createdAt: new Date(),
  };
  const company = { id: companyId, name: 'Acme', createdAt: new Date() };
  const session: SessionData = {
    userId,
    role: 'owner',
    activeCompanyId: companyId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const chatPrisma = {
    conversation: {
      findFirst: jest.fn().mockResolvedValue({ id: 'conversation-1' }),
      create: jest.fn(),
    },
    chatMessage: {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
  const sessions = { create: jest.fn() };
  const incr = jest.fn();
  const expire = jest.fn();
  const redis = {
    getClient: () => ({ incr, expire }),
  };

  let service: AuthService;

  beforeEach(() => {
    Object.values(prisma.user).forEach((mock) => mock.mockReset());
    Object.values(prisma.company).forEach((mock) => mock.mockReset());
    prisma.$transaction.mockReset();
    sessions.create.mockReset();
    incr.mockReset();
    expire.mockReset();
    incr.mockResolvedValue(1);
    expire.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(prisma),
    );
    sessions.create.mockResolvedValue({ token: 'token-1', session });
    prisma.company.create.mockResolvedValue(company);
    prisma.user.create.mockResolvedValue(registeredUser);
    prisma.company.findUnique.mockResolvedValue(company);
    prisma.user.findUnique.mockImplementation(
      (args: { where: Record<string, unknown> }) =>
        'id' in args.where ? registeredUser : null,
    );
    service = new AuthService(
      prisma as never,
      chatPrisma as never,
      sessions as never,
      redis as never,
    );
  });

  it('creates a company with an owner and returns the login response shape', async () => {
    const result = await service.register(
      '  Acme  ',
      'Owner@Example.com',
      'password123',
      '1.2.3.4',
    );

    expect(result).toEqual({
      token: 'token-1',
      user: {
        id: userId,
        email: 'owner@example.com',
        name: 'Owner',
        role: Role.owner,
        locale: null,
      },
      activeCompany: { id: companyId, name: 'Acme' },
    });
    expect(prisma.company.create).toHaveBeenCalledWith({
      data: { name: 'Acme' },
    });
    const calls = prisma.user.create.mock.calls as Array<[unknown]>;
    const createData = (
      (calls[calls.length - 1]?.[0] ?? {}) as {
        data: {
          email: string;
          name: string;
          passwordHash: string;
          role: string;
          companyId: string;
        };
      }
    ).data;
    expect(createData.email).toBe('owner@example.com');
    expect(createData.name).toBe('owner');
    expect(createData.passwordHash).not.toContain('password123');
    expect(createData.passwordHash).not.toBe('password123');
    expect(createData.role).toBe('owner');
    expect(createData.companyId).toBe(companyId);
    expect(sessions.create).toHaveBeenCalledWith({
      userId,
      role: 'owner',
      activeCompanyId: companyId,
    });
  });

  it('rejects a duplicate email with a conflict', async () => {
    prisma.user.findUnique.mockImplementation(
      (args: { where: Record<string, unknown> }) =>
        'id' in args.where ? registeredUser : { id: 'existing' },
    );

    await expect(
      service.register('Acme', 'owner@example.com', 'password123', '1.2.3.4'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.company.create).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only company name without touching the database', async () => {
    await expect(
      service.register('   ', 'owner@example.com', 'password123', '1.2.3.4'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.company.create).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('maps a company-name unique violation to a conflict', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['name'] },
      }),
    );

    await expect(
      service.register('Acme', 'owner@example.com', 'password123', '1.2.3.4'),
    ).rejects.toThrow(/company name/i);
  });

  it('maps an email unique violation race to a conflict', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['email'] },
      }),
    );

    await expect(
      service.register('Acme', 'owner@example.com', 'password123', '1.2.3.4'),
    ).rejects.toThrow(/email/i);
  });

  it('throttles registration past the per-IP limit with a 429', async () => {
    incr.mockResolvedValue(11);

    await expect(
      service.register('Acme', 'owner@example.com', 'password123', '1.2.3.4'),
    ).rejects.toMatchObject({ status: 429 });
    expect(incr).toHaveBeenCalledWith(
      expect.stringContaining('auth:rate:register:1.2.3.4'),
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.company.create).not.toHaveBeenCalled();
  });

  it('throttles login past the per-IP limit with a 429', async () => {
    incr.mockResolvedValue(11);

    await expect(
      service.login('owner@example.com', 'password123', '1.2.3.4'),
    ).rejects.toMatchObject({ status: 429 });
    expect(incr).toHaveBeenCalledWith(
      expect.stringContaining('auth:rate:login:1.2.3.4'),
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('register DTO contracts', () => {
  const validRegister = {
    companyName: 'Acme',
    email: 'owner@example.com',
    password: 'password123',
  } as const;

  const messagesFor = (errors: ValidationError[]) =>
    errors.flatMap((error) => Object.keys(error.constraints ?? {}));

  it('accepts a valid register payload', async () => {
    const dto = Object.assign(new RegisterDto(), validRegister);

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a weak password', async () => {
    const dto = Object.assign(new RegisterDto(), validRegister, {
      password: 'short',
    });

    expect(messagesFor(await validate(dto))).toContain('minLength');
  });

  it('rejects a single-character company name', async () => {
    const dto = Object.assign(new RegisterDto(), validRegister, {
      companyName: 'A',
    });

    expect(messagesFor(await validate(dto))).toContain('minLength');
  });

  it('rejects an invalid email', async () => {
    const dto = Object.assign(new RegisterDto(), validRegister, {
      email: 'not-an-email',
    });

    expect(messagesFor(await validate(dto))).toContain('isEmail');
  });
});
