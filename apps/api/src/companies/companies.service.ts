import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionData, isPlatformRole } from '../auth/session.types';

const MAX_GUIDELINE_BYTES = 10 * 1024 * 1024; // 10MB, matches boilerplate

export type CompanyListItem = {
  id: string;
  name: string;
  createdAt: Date;
  guidelineFileName: string | null;
  guidelineUpdatedAt: Date | null;
  hasGuidelines: boolean;
  messageCount: number;
};

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

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
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
        _count: { select: { messages: true } },
      },
    });

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      hasGuidelines: Boolean(company.guidelineText),
      messageCount: company._count.messages,
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
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
        _count: { select: { messages: true } },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      hasGuidelines: Boolean(company.guidelineText),
      guidelineText: company.guidelineText,
      messageCount: company._count.messages,
    };
  }

  async create(
    session: SessionData,
    name: string,
    file?: Express.Multer.File,
  ) {
    if (!isPlatformRole(session.role)) {
      throw new ForbiddenException('Only root and admin can create companies');
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Company name is required');
    }

    const guideline = file ? this.parseGuidelineFile(file) : null;

    try {
      const company = await this.prisma.company.create({
        data: {
          name: trimmed,
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
          guidelineFileName: true,
          guidelineUpdatedAt: true,
          guidelineText: true,
        },
      });

      return {
        id: company.id,
        name: company.name,
        createdAt: company.createdAt,
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
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
        _count: { select: { messages: true } },
      },
    });

    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      hasGuidelines: Boolean(company.guidelineText),
      messageCount: company._count.messages,
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
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
        _count: { select: { messages: true } },
      },
    });

    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      hasGuidelines: false,
      messageCount: company._count.messages,
    };
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
