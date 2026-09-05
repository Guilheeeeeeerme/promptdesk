import { validate } from 'class-validator';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SessionData } from '../auth/session.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

describe('UsersService authorization contracts', () => {
  const companyA = 'company-a';
  const companyB = 'company-b';
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

  const session = (role: SessionData['role'], activeCompanyId = companyA) =>
    ({
      userId: `${role}-user`,
      role,
      activeCompanyId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }) satisfies SessionData;

  let users: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    users = new UsersService(prisma as never, redis as never);
  });

  it('allows root access only to users in the active company', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await users.list(session('root'));

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: companyA } }),
    );
    expect(prisma.user.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: companyB } }),
    );
  });

  it('allows admins to manage non-root users but protects root users', async () => {
    const root = { id: 'root-id', companyId: companyA, role: Role.root };
    prisma.user.findUnique.mockResolvedValue(root);

    await expect(
      users.update(session('admin'), root.id, { role: 'agent' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.remove(session('admin'), root.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows managers to manage agents but rejects privileged users and roles', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'target-id',
      companyId: companyA,
      role: Role.manager,
    });

    await expect(
      users.update(session('manager'), 'target-id', { role: 'admin' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      users.update(session('manager'), 'target-id', { name: 'Renamed' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects agents from every users operation', async () => {
    await expect(users.list(session('agent'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      users.create(session('agent'), {
        email: 'new@example.com',
        name: 'New User',
        role: 'agent',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects operations outside the active company', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'other-company-user',
      companyId: companyB,
      role: Role.agent,
    });

    await expect(
      users.update(session('root'), 'other-company-user', { name: 'Nope' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('protects the last root from deletion and demotion', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'last-root',
      companyId: companyA,
      role: Role.root,
    });
    prisma.user.count.mockResolvedValue(1);

    await expect(users.remove(session('root'), 'last-root')).rejects.toThrow(
      /last root/i,
    );
    await expect(
      users.update(session('root'), 'last-root', { role: 'admin' }),
    ).rejects.toThrow(/last root/i);
  });

  it('never exposes password hashes in service responses', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'agent-id',
        email: 'agent@example.com',
        name: 'Agent',
        role: Role.agent,
        companyId: companyA,
        passwordHash: 'secret-hash',
        createdAt: new Date(),
      },
    ]);

    const [result] = await users.list(session('root'));

    expect(result).toEqual(
      expect.objectContaining({
        id: 'agent-id',
        email: 'agent@example.com',
        name: 'Agent',
        role: Role.agent,
        companyId: companyA,
      }),
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid create and update input', async () => {
    const create = Object.assign(new CreateUserDto(), {
      email: 'not-an-email',
      name: ' ',
      role: 'superuser',
      password: 'short',
    });
    const update = Object.assign(new UpdateUserDto(), { unknown: true });

    expect(await validate(create)).not.toHaveLength(0);
    expect(
      await validate(update, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toHaveLength(0);
  });
});
