import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SessionService } from '../auth/session.service';
import { SessionData, SessionRole } from '../auth/session.types';
import { PrismaService } from '../prisma/prisma.service';
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
    private readonly sessions: SessionService,
  ) {}

  async list(session: SessionData): Promise<UserView[]> {
    const companyId = this.mutationScope(session);
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
          role: dto.role,
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

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        await this.lockCompany(tx, companyId);
        const target = await this.findTarget(id, companyId, tx);
        this.assertCanManageTarget(session, target.role, target.id);

        if (dto.role && dto.role !== target.role) {
          if (target.id === session.userId) {
            throw new ForbiddenException('You cannot demote yourself');
          }
          this.assertRoleMayCreate(session.role, dto.role);
          await this.assertNotLastRoot(target, companyId, tx);
        }

        return tx.user.update({
          where: { id },
          data: {
            ...(dto.email === undefined
              ? {}
              : { email: dto.email.toLowerCase() }),
            ...(dto.name === undefined ? {} : { name: dto.name }),
            ...(dto.role === undefined ? {} : { role: dto.role }),
            ...(dto.password === undefined
              ? {}
              : { passwordHash: await bcrypt.hash(dto.password, 12) }),
          },
          select: USER_VIEW,
        });
      });
      return this.toView(user);
    } catch (error) {
      this.rethrowDuplicateEmail(error);
      throw error;
    }
  }

  async remove(session: SessionData, id: string): Promise<{ ok: true }> {
    const companyId = this.mutationScope(session);
    const targetId = await this.prisma.$transaction(async (tx) => {
      await this.lockCompany(tx, companyId);
      const target = await this.findTarget(id, companyId, tx);
      this.assertCanManageTarget(session, target.role, target.id);
      await this.assertNotLastRoot(target, companyId, tx);

      await tx.user.delete({ where: { id } });
      return target.id;
    });
    await this.sessions.destroyForUser(targetId);
    return { ok: true };
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

  private async findTarget(
    id: string,
    companyId: string,
    db: Pick<PrismaService, 'user'> | Prisma.TransactionClient = this.prisma,
  ) {
    const target = await db.user.findUnique({
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
    if (
      session.role === 'owner' &&
      ['owner', 'manager', 'agent'].includes(targetRole)
    ) {
      return;
    }
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
    if (actor === 'owner' && ['owner', 'manager', 'agent'].includes(target)) {
      return;
    }
    if (actor === 'manager' && target === 'agent') return;
    throw new ForbiddenException('You cannot assign this role');
  }

  private async assertNotLastRoot(
    target: { role: Role },
    companyId: string,
    db: Pick<PrismaService, 'user'> | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (target.role !== Role.root) return;
    const roots = await db.user.count({
      where: { role: Role.root, companyId },
    });
    if (roots <= 1) {
      throw new BadRequestException(
        'Cannot remove or demote the last root user',
      );
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Email is already in use');
    }
  }

  private async lockCompany(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<void> {
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`;
    }
  }
}
