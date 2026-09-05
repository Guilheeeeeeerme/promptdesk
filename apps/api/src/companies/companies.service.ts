import { createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatPrismaService } from '../prisma/chat-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionData, isPlatformRole } from '../auth/session.types';
import { RedisService } from '../redis/redis.service';

const MAX_GUIDELINE_BYTES = 10 * 1024 * 1024; // 10MB, matches boilerplate
const GUIDELINE_UPLOAD_LIMIT = 10;

export type CompanyListItem = {
  id: string;
  name: string;
  createdAt: Date;
  guidelineFileName: string | null;
  guidelineUpdatedAt: Date | null;
  currentVersion: number | null;
  hasGuidelines: boolean;
  messageCount: number;
};

export type GuidelineVersionMeta = {
  id: string;
  version: number;
  fileName: string | null;
  contentHash: string;
  byteSize: number | null;
  createdAt: Date;
};

export type GuidelineVersionDetail = GuidelineVersionMeta & {
  content: string;
};

function hashGuidelineContent(content: string): {
  contentHash: string;
  byteSize: number;
} {
  const buffer = Buffer.from(content, 'utf8');
  return {
    contentHash: createHash('sha256').update(buffer).digest('hex'),
    byteSize: buffer.byteLength,
  };
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatPrisma: ChatPrismaService,
    private readonly redis: RedisService,
  ) {}

  private async enforceUploadRateLimit(
    session: SessionData,
    companyId: string,
  ): Promise<void> {
    const key = `guideline:upload:${companyId}:${session.userId}`;
    const count = await this.redis.getClient().incr(key);
    if (count === 1) await this.redis.getClient().expire(key, 60);
    if (count > GUIDELINE_UPLOAD_LIMIT) {
      throw new HttpException(
        'Too many guideline uploads — wait a moment and try again',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

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
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
        currentGuidelineVersion: { select: { version: true } },
      },
    });

    const counts = await this.messageCountsByCompany(
      companies.map((c) => c.id),
    );

    return companies.map((company) => ({
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      currentVersion: company.currentGuidelineVersion?.version ?? null,
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
        guidelineFileName: true,
        guidelineUpdatedAt: true,
        guidelineText: true,
        currentGuidelineVersion: { select: { version: true } },
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
      currentVersion: company.currentGuidelineVersion?.version ?? null,
      hasGuidelines: Boolean(company.guidelineText),
      guidelineText: company.guidelineText,
      messageCount: await this.messageCountFor(company.id),
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
      const company = await this.prisma.$transaction(async (tx) => {
        const created = await tx.company.create({
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
        });

        if (guideline) {
          const version = await tx.guidelineVersion.create({
            data: {
              companyId: created.id,
              version: 1,
              content: guideline.text,
              fileName: guideline.fileName,
              ...hashGuidelineContent(guideline.text),
              createdById: session.userId,
            },
          });

          await tx.company.update({
            where: { id: created.id },
            data: { currentGuidelineVersionId: version.id },
          });
        }

        return tx.company.findUniqueOrThrow({
          where: { id: created.id },
          select: {
            id: true,
            name: true,
            createdAt: true,
            guidelineFileName: true,
            guidelineUpdatedAt: true,
            guidelineText: true,
            currentGuidelineVersion: { select: { version: true } },
          },
        });
      });

      return {
        id: company.id,
        name: company.name,
        createdAt: company.createdAt,
        guidelineFileName: company.guidelineFileName,
        guidelineUpdatedAt: company.guidelineUpdatedAt,
        currentVersion: company.currentGuidelineVersion?.version ?? null,
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
    await this.enforceUploadRateLimit(session, companyId);
    const guideline = this.parseGuidelineFile(file);

    const company = await this.prisma.$transaction(async (tx) => {
      const last = await tx.guidelineVersion.findFirst({
        where: { companyId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const version = await tx.guidelineVersion.create({
        data: {
          companyId,
          version: (last?.version ?? 0) + 1,
          content: guideline.text,
          fileName: guideline.fileName,
          ...hashGuidelineContent(guideline.text),
          createdById: session.userId,
        },
      });

      return tx.company.update({
        where: { id: companyId },
        data: {
          guidelineText: guideline.text,
          guidelineFileName: guideline.fileName,
          guidelineUpdatedAt: new Date(),
          currentGuidelineVersionId: version.id,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          guidelineFileName: true,
          guidelineUpdatedAt: true,
          guidelineText: true,
          currentGuidelineVersion: { select: { version: true } },
        },
      });
    });

    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      guidelineFileName: company.guidelineFileName,
      guidelineUpdatedAt: company.guidelineUpdatedAt,
      currentVersion: company.currentGuidelineVersion?.version ?? null,
      hasGuidelines: Boolean(company.guidelineText),
      messageCount: await this.messageCountFor(company.id),
    };
  }

  async deleteGuidelines(session: SessionData, companyId: string) {
    await this.assertCanManage(session, companyId);

    // Clears the current guideline; immutable version history is retained
    // (there is intentionally no endpoint to delete versions).
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        guidelineText: null,
        guidelineFileName: null,
        guidelineUpdatedAt: null,
        currentGuidelineVersionId: null,
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
      currentVersion: null,
      hasGuidelines: false,
      messageCount: await this.messageCountFor(company.id),
    };
  }

  async listGuidelineVersions(
    session: SessionData,
    companyId: string,
  ): Promise<GuidelineVersionMeta[]> {
    await this.assertCanAccess(session, companyId);

    return this.prisma.guidelineVersion.findMany({
      where: { companyId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        fileName: true,
        contentHash: true,
        byteSize: true,
        createdAt: true,
      },
    });
  }

  async getGuidelineVersion(
    session: SessionData,
    companyId: string,
    versionId: string,
  ): Promise<GuidelineVersionDetail> {
    await this.assertCanAccess(session, companyId);

    const version = await this.prisma.guidelineVersion.findFirst({
      where: { id: versionId, companyId },
      select: {
        id: true,
        version: true,
        fileName: true,
        contentHash: true,
        byteSize: true,
        createdAt: true,
        content: true,
      },
    });

    if (!version) {
      throw new NotFoundException('Guideline version not found');
    }

    return version;
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
