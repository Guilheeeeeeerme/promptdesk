import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';
import { SessionData, SessionRole, isPlatformRole } from './session.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async login(email: string, password: string) {
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

    if (isPlatformRole(user.role as SessionRole)) {
      if (!activeCompanyId) {
        const firstCompany = await this.prisma.company.findFirst({
          orderBy: { createdAt: 'asc' },
        });
        activeCompanyId = firstCompany?.id ?? null;
      }
    }

    const { token, session } = await this.sessions.create({
      userId: user.id,
      role: user.role as SessionRole,
      activeCompanyId,
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

  private async buildAuthResponse(
    token: string | null,
    session: SessionData,
  ) {
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
      },
      activeCompany,
    };

    if (token) {
      return { token, ...payload };
    }

    return payload;
  }
}
