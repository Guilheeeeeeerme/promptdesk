import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { validate, ValidationError } from 'class-validator';
import { SessionData } from '../auth/session.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

describe('UsersService authorization contracts', () => {
  const companyA = 'company-a';
  const companyB = 'company-b';
  const targetId = 'target-id';
  const safeUser = {
    id: targetId,
    email: 'target@example.com',
    name: 'Target User',
    role: Role.agent,
    companyId: companyA,
    createdAt: new Date(),
  };
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const redis = { getClient: jest.fn() };

  const session = (
    role: SessionData['role'],
    activeCompanyId: string | null = companyA,
  ) =>
    ({
      userId: `${role}-user`,
      role,
      activeCompanyId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }) satisfies SessionData;

  const createInput = (role: SessionData['role'] = 'agent') => ({
    email: 'new@example.com',
    name: 'New User',
    role,
    password: 'password123',
  });
  const updateInput = { name: 'Updated User' };

  let users: UsersService;

  beforeEach(() => {
    Object.values(prisma.user).forEach((mock) => mock.mockReset());
    prisma.$transaction.mockReset();
    redis.getClient.mockReset();
    users = new UsersService(prisma as never, redis as never);
  });

  describe.each([
    ['root', session('root')],
    ['admin', session('admin')],
    ['manager', session('manager')],
  ] as const)('%s operation permissions', (role, actor) => {
    it(`${role} can list users in the active company`, async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await expect(users.list(actor)).resolves.toEqual([]);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: companyA } }),
      );
    });

    it(`${role} can create an allowed user in the active company`, async () => {
      prisma.user.create.mockResolvedValue(safeUser);

      await expect(users.create(actor, createInput())).resolves.toEqual(
        safeUser,
      );
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: companyA }),
        }),
      );
    });

    it(`${role} can update an allowed user in the active company`, async () => {
      prisma.user.findUnique.mockResolvedValue(safeUser);
      prisma.user.update.mockResolvedValue({ ...safeUser, ...updateInput });

      await expect(users.update(actor, targetId, updateInput)).resolves.toEqual(
        expect.objectContaining(updateInput),
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: targetId, companyId: companyA },
        }),
      );
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it(`${role} can remove an allowed user in the active company`, async () => {
      prisma.user.findUnique.mockResolvedValue(safeUser);
      prisma.user.count.mockResolvedValue(2);
      prisma.user.delete.mockResolvedValue(safeUser);

      await expect(users.remove(actor, targetId)).resolves.toEqual(safeUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: targetId, companyId: companyA },
        }),
      );
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: targetId },
      });
    });
  });

  it('denies admin create, update, and remove operations targeting roots', async () => {
    const root = { ...safeUser, role: Role.root };
    prisma.user.findUnique.mockResolvedValue(root);

    await expect(
      users.create(session('admin'), createInput('root')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.update(session('admin'), targetId, updateInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.remove(session('admin'), targetId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies managers create privileged roles', async () => {
    await expect(
      users.create(session('manager'), createInput('root')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.create(session('manager'), createInput('admin')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.create(session('manager'), createInput('manager')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe.each([Role.root, Role.admin, Role.manager])(
    'manager target protection for %s users',
    (targetRole) => {
      beforeEach(() => {
        prisma.user.findUnique.mockResolvedValue({
          ...safeUser,
          role: targetRole,
        });
      });

      it('denies update and remove operations', async () => {
        await expect(
          users.update(session('manager'), targetId, updateInput),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          users.remove(session('manager'), targetId),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    },
  );

  it('denies agents from list, create, update, and remove', async () => {
    await expect(users.list(session('agent'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      users.create(session('agent'), createInput()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.update(session('agent'), targetId, updateInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.remove(session('agent'), targetId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('active-company isolation', () => {
    it.each([
      ['list', async () => users.list(session('root'))],
      ['create', async () => users.create(session('root'), createInput())],
      [
        'update',
        async () => users.update(session('root'), targetId, updateInput),
      ],
      ['remove', async () => users.remove(session('root'), targetId)],
    ])('%s uses the active company scope', async (_operation, operation) => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(safeUser);

      await operation().catch(() => undefined);

      if (_operation === 'list') {
        expect(prisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { companyId: companyA } }),
        );
      } else if (_operation === 'create') {
        expect(prisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ companyId: companyA }),
          }),
        );
      } else {
        expect(prisma.user.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: targetId, companyId: companyA },
          }),
        );
        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(prisma.user.delete).not.toHaveBeenCalled();
      }
    });

    it('does not mutate or delete a cross-company user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...safeUser,
        companyId: companyB,
      });

      await expect(
        users.update(session('root'), targetId, updateInput),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        users.remove(session('root'), targetId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('uses a non-matching scope and denies management without an active company', async () => {
      const noCompany = session('root', null);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(users.list(noCompany)).resolves.toEqual([]);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: '__none__' } }),
      );
      await expect(
        users.create(noCompany, createInput()),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        users.update(noCompany, targetId, updateInput),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(users.remove(noCompany, targetId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });

  it('protects the last root from deletion and demotion', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...safeUser, role: Role.root });
    prisma.user.count.mockResolvedValue(1);

    await expect(users.remove(session('root'), targetId)).rejects.toThrow(
      /last root/i,
    );
    await expect(
      users.update(session('root'), targetId, { role: 'admin' }),
    ).rejects.toThrow(/last root/i);
  });

  it('never exposes password hashes in service responses', async () => {
    prisma.user.findMany.mockResolvedValue([
      { ...safeUser, passwordHash: 'secret-hash' },
    ]);

    const [result] = await users.list(session('root'));

    expect(result).toEqual(expect.objectContaining(safeUser));
    expect(result).not.toHaveProperty('passwordHash');
  });
});

describe('user DTO contracts', () => {
  const validCreate = {
    email: 'valid@example.com',
    name: 'Valid User',
    role: 'agent',
    password: 'password123',
  } as const;
  const pipeOptions = { whitelist: true, forbidNonWhitelisted: true };

  const messagesFor = (errors: ValidationError[]) =>
    errors.flatMap((error) => Object.keys(error.constraints ?? {}));

  it.each([
    ['email', { email: 'not-an-email' }],
    ['name', { name: '' }],
    ['role', { role: 'superuser' }],
    ['password', { password: 'short' }],
  ])(
    'rejects invalid create %s input independently',
    async (_field, change) => {
      const dto = Object.assign(new CreateUserDto(), validCreate, change);

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it('rejects a whitespace-only create name independently', async () => {
    const dto = Object.assign(new CreateUserDto(), validCreate, {
      name: '   ',
    });

    expect(messagesFor(await validate(dto))).toContain('matches');
  });

  it.each([
    ['email', { email: 'not-an-email' }],
    ['name', { name: '' }],
    ['role', { role: 'superuser' }],
    ['password', { password: 'short' }],
  ])(
    'rejects supplied invalid update %s independently',
    async (_field, change) => {
      const dto = Object.assign(new UpdateUserDto(), change);

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it('rejects a whitespace-only update name independently', async () => {
    const dto = Object.assign(new UpdateUserDto(), { name: '\t  ' });

    expect(messagesFor(await validate(dto))).toContain('matches');
  });

  it('accepts an empty update patch', async () => {
    expect(await validate(new UpdateUserDto())).toHaveLength(0);
  });

  it.each([
    ['email', { email: validCreate.email }],
    ['name', { name: validCreate.name }],
    ['role', { role: validCreate.role }],
    ['password', { password: validCreate.password }],
  ])('accepts a valid single-field %s patch', async (_field, patch) => {
    const dto = Object.assign(new UpdateUserDto(), patch);

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects unknown update fields through the global validation pipe contract', async () => {
    const dto = Object.assign(new UpdateUserDto(), { unknown: true });

    expect(await validate(dto, pipeOptions)).not.toHaveLength(0);
  });
});
