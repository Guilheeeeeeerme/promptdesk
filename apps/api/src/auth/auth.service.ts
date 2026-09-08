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
import { GuidelineValidationStatus, Role } from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ChatPrismaService } from '../prisma/chat-prisma.service';
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
    private readonly chatPrisma: ChatPrismaService,
    private readonly sessions: SessionService,
    private readonly redis: RedisService,
  ) {}

  async demo(ip: string) {
    await this.enforceAuthRateLimit('demo', ip);
    const { user, companyId } = await this.ensureDemoWorld();
    const { token, session } = await this.sessions.create({
      userId: user.id,
      role: user.role,
      activeCompanyId: companyId,
    });
    return this.buildAuthResponse(token, session);
  }

  private async ensureDemoWorld() {
    const guideline = [
      'Acme Demo Co — Support Guidelines',
      '',
      '- Refunds: available within 14 days of purchase; resolve instantly via dashboard.',
      '- Shipping: orders ship in 1-2 business days; free over $50.',
      '- Account issues: escalate to the platform team (in the demo, explain this is AI-answered).',
      '- Always stay friendly, concise, and respond in English.',
    ].join('\n');

    const company = await this.prisma.company.upsert({
      where: { name: 'Acme Demo Co' },
      update: {},
      create: { name: 'Acme Demo Co' },
    });

    let user = await this.prisma.user.findUnique({
      where: { email: 'demo@acme-demo.local' },
      include: { company: true },
    });
    if (user && user.role !== Role.manager) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: Role.manager },
        include: { company: true },
      });
    }
    if (!user) {
      await this.prisma.user
        .create({
          data: {
            email: 'demo@acme-demo.local',
            name: 'Demo Manager',
            passwordHash: await bcrypt.hash(randomUUID(), 12),
            role: Role.manager,
            companyId: company.id,
          },
        })
        .catch((error) => {
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2002'
          ) {
            throw error;
          }
          return null;
        });
      user = await this.prisma.user.findUnique({
        where: { email: 'demo@acme-demo.local' },
        include: { company: true },
      });
    }
    if (!user) {
      throw new Error('demo user unavailable');
    }

    await this.expireDemoGuests(company.id, user.id);

    if (!company.guidelineText) {
      const hash = createHash('sha256').update(guideline).digest('hex');
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.guidelineVersion.create({
          data: {
            companyId: company.id,
            version: 1,
            content: guideline,
            fileName: 'demo-guideline.md',
            contentHash: hash,
            byteSize: Buffer.byteLength(guideline),
            status: GuidelineValidationStatus.valid,
            validatedAt: new Date(),
          },
        });
        await tx.company.update({
          where: { id: company.id },
          data: {
            guidelineText: guideline,
            guidelineFileName: 'demo-guideline.md',
            guidelineUpdatedAt: new Date(),
            currentGuidelineVersionId: created.id,
          },
        });
      });
    }

    await this.seedDemoChat(company.id, user.id);

    return { user, companyId: company.id };
  }

  private readonly DEMO_GUEST_TTL_HOURS = 72;

  /**
   * Demo-company accounts minted by demo visitors carry a lifecycle deadline.
   * Every demo login renews the deadline and drops whatever expired.
   */
  private async expireDemoGuests(companyId: string, demoUserId: string) {
    const now = new Date();
    const horizon = new Date(
      now.getTime() + this.DEMO_GUEST_TTL_HOURS * 3_600_000,
    );
    const guests = await this.prisma.user.findMany({
      where: { companyId, id: { not: demoUserId } },
      select: { id: true, expiresAt: true },
    });
    if (guests.length === 0) {
      return;
    }
    const expired: string[] = [];
    for (const guest of guests) {
      if (guest.expiresAt && guest.expiresAt <= now) {
        expired.push(guest.id);
      } else if (!guest.expiresAt) {
        await this.prisma.user.update({
          where: { id: guest.id },
          data: { expiresAt: horizon },
        });
      }
    }
    if (expired.length > 0) {
      await this.chatPrisma.chatMessage.deleteMany({
        where: { userId: { in: expired } },
      });
      await this.chatPrisma.conversation.deleteMany({
        where: { userId: { in: expired } },
      });
      await this.prisma.user.deleteMany({ where: { id: { in: expired } } });
    }
  }

  private async seedDemoChat(companyId: string, userId: string) {
    const existing = await this.chatPrisma.conversation.findFirst({
      where: { companyId, userId },
      select: { id: true },
    });
    if (existing) {
      return;
    }
    const conversation = await this.chatPrisma.conversation.create({
      data: { companyId, userId, title: 'AI Support tour' },
    });
    await this.chatPrisma.chatMessage.createMany({
      data: [
        {
          companyId,
          userId,
          conversationId: conversation.id,
          role: 'user',
          content:
            'What is your refund policy and how fast do refunds get processed?',
        },
        {
          companyId,
          userId,
          conversationId: conversation.id,
          role: 'assistant',
          content:
            "Welcome! I answer questions grounded in Acme Demo Co's support guidelines stored in this workspace. The message above is a sample question — open a new thread and ask anything to see a grounded AI answer.",
        },
      ],
    });
  }

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
    kind: 'login' | 'register' | 'demo',
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
