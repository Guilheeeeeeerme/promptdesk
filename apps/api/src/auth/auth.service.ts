import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  parseSupportedLocale,
  type SupportedLocale,
} from '../common/supported-locales';
import { SessionService } from './session.service';
import { SessionData, isPlatformRole } from './session.types';

const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 300;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly redis: RedisService,
  ) {}

  async login(email: string, password: string, ip: string) {
    await this.enforceAuthRateLimit('login', ip);

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    let activeCompanyId: string | null = user.companyId;

    if (isPlatformRole(user.role)) {
      if (!activeCompanyId) {
        const firstCompany = await this.prisma.company.findFirst({
          orderBy: { createdAt: 'asc' },
        });
        activeCompanyId = firstCompany?.id ?? null;
      }
    }

    const { token, session } = await this.sessions.create({
      userId: user.id,
      role: user.role,
      activeCompanyId,
    });

    return this.buildAuthResponse(token, session);
  }

  async register(
    companyName: string,
    email: string,
    password: string,
    ip: string,
  ) {
    await this.enforceAuthRateLimit('register', ip);

    const name = companyName.trim();
    if (!name) {
      throw new BadRequestException('Company name is required');
    }

    const normalizedEmail = email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { company, user } = await this.prisma
      .$transaction(async (tx) => {
        const company = await tx.company.create({
          data: { name },
        });
        const user = await tx.user.create({
          data: {
            email: normalizedEmail,
            name: normalizedEmail.split('@')[0],
            passwordHash,
            role: 'owner',
            companyId: company.id,
          },
        });
        return { company, user };
      })
      .catch((error) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const target = Array.isArray(error.meta?.target)
            ? (error.meta?.target as string[])
            : [];
          if (target.includes('email')) {
            throw new ConflictException('Email is already registered');
          }
          throw new ConflictException('Company name is already taken');
        }
        throw error;
      });

    const { token, session } = await this.sessions.create({
      userId: user.id,
      role: user.role,
      activeCompanyId: company.id,
    });

    return this.buildAuthResponse(token, session);
  }

  async logout(token: string) {
    await this.sessions.destroy(token);
    return { ok: true };
  }

  async me(session: SessionData) {
    return this.buildAuthResponse(null, session);
  }

  async updateContext(token: string, session: SessionData, companyId: string) {
    if (!isPlatformRole(session.role)) {
      throw new ForbiddenException(
        'Only root and admin can change the active company',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const updated = await this.sessions.updateActiveCompany(token, companyId);
    if (!updated) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return this.buildAuthResponse(token, updated);
  }

  async updateLocale(
    token: string,
    session: SessionData,
    locale: SupportedLocale,
  ) {
    const user = await this.prisma.user.update({
      where: { id: session.userId },
      data: { locale },
    });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return this.buildAuthResponse(token, session);
  }

  /**
   * Fixed 5-minute attempt window per IP for unauthenticated auth endpoints:
   * INCR a bucket counter (TTL-scoped) and reject with 429 past the cap.
   */
  private async enforceAuthRateLimit(
    kind: 'login' | 'register',
    ip: string,
  ): Promise<void> {
    const bucket = Math.floor(
      Date.now() / (AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000),
    );
    const key = `auth:rate:${kind}:${ip}:${bucket}`;
    const count = await this.redis.getClient().incr(key);

    if (count === 1) {
      await this.redis.getClient().expire(key, AUTH_RATE_LIMIT_WINDOW_SECONDS);
    }

    if (count > AUTH_RATE_LIMIT) {
      throw new HttpException(
        'Too many attempts — wait a moment and try again',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async buildAuthResponse(token: string | null, session: SessionData) {
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    let activeCompany: { id: string; name: string } | null = null;
    if (session.activeCompanyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: session.activeCompanyId },
      });
      if (company) {
        activeCompany = { id: company.id, name: company.name };
      }
    }

    const payload = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        locale: parseSupportedLocale(user.locale),
      },
      activeCompany,
    };

    if (token) {
      return { token, ...payload };
    }

    return payload;
  }
}
