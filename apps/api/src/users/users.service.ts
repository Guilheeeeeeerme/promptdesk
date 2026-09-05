import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SessionData, SessionRole } from '../auth/session.types';
import { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export type UserView = {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
  createdAt: Date;
};

const USER_VIEW = {
  id: true,
  email: true,
  name: true,
  role: true,
  companyId: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(session: SessionData): Promise<UserView[]> {
    const companyId = this.listScope(session);
    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: USER_VIEW,
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => this.toView(user));
  }

  async create(session: SessionData, dto: CreateUserDto): Promise<UserView> {
    const companyId = this.mutationScope(session);
    this.assertRoleMayCreate(session.role, dto.role);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          name: dto.name,
          role: dto.role as Role,
          passwordHash: await bcrypt.hash(dto.password, 12),
          companyId,
        },
        select: USER_VIEW,
      });
      return this.toView(user);
    } catch (error) {
      this.rethrowDuplicateEmail(error);
      throw error;
    }
  }

  async update(
    session: SessionData,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserView> {
    const companyId = this.mutationScope(session);
    const target = await this.findTarget(id, companyId);
    this.assertCanManageTarget(session, target.role, target.id);

    if (dto.role && dto.role !== target.role) {
      if (target.id === session.userId) {
        throw new ForbiddenException('You cannot demote yourself');
      }
      this.assertRoleMayCreate(session.role, dto.role);
      await this.assertNotLastRoot(target, companyId);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.email === undefined ? {} : { email: dto.email.toLowerCase() }),
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.role === undefined ? {} : { role: dto.role as Role }),
          ...(dto.password === undefined
            ? {}
            : { passwordHash: await bcrypt.hash(dto.password, 12) }),
        },
        select: { ...USER_VIEW, passwordHash: false },
      });
      return this.toView(user);
    } catch (error) {
      this.rethrowDuplicateEmail(error);
      throw error;
    }
  }

  async remove(session: SessionData, id: string): Promise<UserView> {
    const companyId = this.mutationScope(session);
    const target = await this.findTarget(id, companyId);
    this.assertCanManageTarget(session, target.role, target.id);
    await this.assertNotLastRoot(target, companyId);

    const deleted = await this.prisma.user.delete({
      where: { id },
    });
    await this.destroySessionsForUser(target.id);
    return this.toView(deleted);
  }

  private listScope(session: SessionData): string {
    if (session.role === 'agent') {
      throw new ForbiddenException('Agents cannot manage users');
    }
    return session.activeCompanyId ?? '__none__';
  }

  private mutationScope(session: SessionData): string {
    if (session.role === 'agent') {
      throw new ForbiddenException('Agents cannot manage users');
    }
    if (!session.activeCompanyId) {
      throw new ForbiddenException('An active company is required');
    }
    return session.activeCompanyId;
  }

  private async findTarget(id: string, companyId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id, companyId },
      select: USER_VIEW,
    });
    if (!target || target.companyId !== companyId) {
      throw new NotFoundException('User not found');
    }
    return target;
  }

  private assertCanManageTarget(
    session: SessionData,
    targetRole: SessionRole,
    targetId: string,
  ): void {
    if (session.role === 'root') return;
    if (session.role === 'admin' && targetRole !== 'root') return;
    if (session.role === 'manager' && targetRole === 'agent') return;
    throw new ForbiddenException(
      targetId === session.userId
        ? 'You cannot manage this user'
        : 'You cannot manage this role',
    );
  }

  private assertRoleMayCreate(actor: SessionRole, target: SessionRole): void {
    if (actor === 'root') return;
    if (actor === 'admin' && target !== 'root') return;
    if (actor === 'manager' && target === 'agent') return;
    throw new ForbiddenException('You cannot assign this role');
  }

  private async assertNotLastRoot(
    target: { role: Role },
    companyId: string,
  ): Promise<void> {
    if (target.role !== Role.root) return;
    const roots = await this.prisma.user.count({
      where: { role: Role.root, companyId },
    });
    if (roots <= 1) {
      throw new BadRequestException('Cannot remove or demote the last root user');
    }
  }

  private toView(user: UserView): UserView {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      createdAt: user.createdAt,
    };
  }

  private rethrowDuplicateEmail(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Email is already in use');
    }
  }

  private async destroySessionsForUser(userId: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        'session:*',
        'COUNT',
        100,
      );
      cursor = nextCursor;
      for (const key of keys) {
        const raw = await client.get(key);
        if (!raw) continue;
        try {
          const session = JSON.parse(raw) as Partial<SessionData>;
          if (session.userId === userId) await client.del(key);
        } catch {
          // Ignore malformed or concurrently expired session records.
        }
      }
    } while (cursor !== '0');
  }
}
