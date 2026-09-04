import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatPrismaService } from '../prisma/chat-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionData, isPlatformRole } from '../auth/session.types';
import { SUPPORTED_LANGUAGES } from './dto/company-language';

const MAX_GUIDELINE_BYTES = 10 * 1024 * 1024; // 10MB, matches boilerplate

export type CompanyListItem = {
  id: string;
  name: string;
  createdAt: Date;
  defaultLanguage: string;
  guidelineFileName: string | null;
  guidelineUpdatedAt: Date | null;
  hasGuidelines: boolean;
  messageCount: number;
};

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatPrisma: ChatPrismaService,
  ) {}

  private async messageCountFor(companyId: string): Promise<number> {
    return this.chatPrisma.chatMessage.count({ where: { companyId } });
  }

  private async messageCountsByCompany(
    companyIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>(companyIds.map((id) => [id, 0]));
    if (companyIds.length === 0) return counts;

    const grouped = await this.chatPrisma.chatMessage.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      counts.set(row.companyId, row._count._all);
    }
    return counts;
  }

  async list(session: SessionData): Promise<CompanyListItem[]> {
    const where = isPlatformRole(session.role)
      ? undefined
      : { id: session.activeCompanyId ?? '__none__' };

    const companies = await this.prisma.company.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        defaultLanguage: true,
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
      },
    });

    const counts = await this.messageCountsByCompany(
      companies.map((c) => c.id),
    );

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      defaultLanguage: company.defaultLanguage,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      hasGuidelines: Boolean(company.guidelineText),
      messageCount: counts.get(company.id) ?? 0,
    }));
  }

  async getOne(session: SessionData, companyId: string) {
    await this.assertCanAccess(session, companyId);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        defaultLanguage: true,
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      defaultLanguage: company.defaultLanguage,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      hasGuidelines: Boolean(company.guidelineText),
      guidelineText: company.guidelineText,
      messageCount: await this.messageCountFor(company.id),
    };
  }

  async create(
    session: SessionData,
    name: string,
    file?: Express.Multer.File,
    defaultLanguage?: string,
  ) {
    if (!isPlatformRole(session.role)) {
      throw new ForbiddenException('Only root and admin can create companies');
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Company name is required');
    }

    const language = this.parseDefaultLanguage(defaultLanguage);
    const guideline = file ? this.parseGuidelineFile(file) : null;

    try {
      const company = await this.prisma.company.create({
        data: {
          name: trimmed,
          ...(language ? { defaultLanguage: language } : {}),
          ...(guideline
            ? {
                guidelineText: guideline.text,
                guidelineFileName: guideline.fileName,
                guidelineUpdatedAt: new Date(),
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          defaultLanguage: true,
          guidelineFileName: true,
          guidelineUpdatedAt: true,
          guidelineText: true,
        },
      });

      return {
        id: company.id,
        name: company.name,
        createdAt: company.createdAt,
        defaultLanguage: company.defaultLanguage,
        guidelineFileName: company.guidelineFileName,
        guidelineUpdatedAt: company.guidelineUpdatedAt,
        hasGuidelines: Boolean(company.guidelineText),
        messageCount: 0,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('A company with that name already exists');
      }
      throw error;
    }
  }

  async update(
    session: SessionData,
    companyId: string,
    defaultLanguage?: string,
  ) {
    await this.assertCanManage(session, companyId);

    const language = this.parseDefaultLanguage(defaultLanguage);
    if (!language) {
      throw new BadRequestException('defaultLanguage is required');
    }

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: { defaultLanguage: language },
      select: {
        id: true,
        name: true,
        createdAt: true,
        defaultLanguage: true,
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
      },
    });

    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      defaultLanguage: company.defaultLanguage,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      hasGuidelines: Boolean(company.guidelineText),
      messageCount: await this.messageCountFor(company.id),
    };
  }

  async uploadGuidelines(
    session: SessionData,
    companyId: string,
    file: Express.Multer.File,
  ) {
    await this.assertCanManage(session, companyId);
    const guideline = this.parseGuidelineFile(file);

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        guidelineText: guideline.text,
        guidelineFileName: guideline.fileName,
        guidelineUpdatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        defaultLanguage: true,
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
      },
    });

    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      defaultLanguage: company.defaultLanguage,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      hasGuidelines: Boolean(company.guidelineText),
      messageCount: await this.messageCountFor(company.id),
    };
  }

  async deleteGuidelines(session: SessionData, companyId: string) {
    await this.assertCanManage(session, companyId);

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        guidelineText: null,
        guidelineFileName: null,
        guidelineUpdatedAt: null,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        defaultLanguage: true,
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
      },
    });

    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      defaultLanguage: company.defaultLanguage,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      hasGuidelines: false,
      messageCount: await this.messageCountFor(company.id),
    };
  }

  private parseDefaultLanguage(value?: string): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(value)) {
      throw new BadRequestException(
        `defaultLanguage must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
      );
    }
    return value;
  }

  private parseGuidelineFile(file: Express.Multer.File): {
    text: string;
    fileName: string;
  } {
    if (!file) {
      throw new BadRequestException('Guidelines file is required');
    }

    if (file.size > MAX_GUIDELINE_BYTES) {
      throw new BadRequestException('Guidelines file must be 10MB or smaller');
    }

    const original = file.originalname || 'guidelines.txt';
    const lower = original.toLowerCase();
    if (!lower.endsWith('.txt')) {
      throw new BadRequestException('Only .txt guideline files are supported');
    }

    const text = file.buffer.toString('utf8').trim();
    if (!text) {
      throw new BadRequestException('Guidelines file is empty');
    }

    return { text, fileName: original };
  }

  private async assertCanAccess(session: SessionData, companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (isPlatformRole(session.role)) {
      return;
    }

    if (session.activeCompanyId !== companyId) {
      throw new ForbiddenException('You cannot access this company');
    }
  }

  private async assertCanManage(session: SessionData, companyId: string) {
    await this.assertCanAccess(session, companyId);

    if (session.role === 'agent') {
      throw new ForbiddenException(
        'Agents cannot upload or clear company guidelines',
      );
    }
  }
}
