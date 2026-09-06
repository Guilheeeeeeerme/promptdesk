import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CorePrismaService } from './core-prisma.service';
import { GeminiService } from './gemini.service';
import { OpenAiService } from './openai.service';
import { GuidelineValidator } from './guideline-validator';
import { GUIDELINE_VALIDATE_QUEUE, type GuidelineValidateJobData } from './chat.constants';

@Processor(GUIDELINE_VALIDATE_QUEUE)
export class GuidelineValidationProcessor extends WorkerHost {
  constructor(
    private readonly prisma: CorePrismaService,
    private readonly gemini: GeminiService,
    private readonly openai: OpenAiService,
  ) { super(); }

  async process(job: Job<GuidelineValidateJobData>): Promise<void> {
    const { companyId, versionId } = job.data;
    const version = await this.prisma.guidelineVersion.findFirst({
      where: { id: versionId, companyId },
      select: { id: true, content: true, status: true },
    });
    if (!version || version.status !== 'pending') return;

    const result = await new GuidelineValidator(
      this.openai.isConfigured() ? this.openai : this.gemini,
    ).validate({ content: version.content });
    const status = result.status === 'valid'
      ? 'valid'
      : result.status === 'provider_error' ? 'provider_error' : 'invalid';
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.guidelineVersion.update({
        where: { id: version.id },
        data: { status, validationReason: result.reason ?? null, validatedAt: now },
      });
      if (status !== 'valid') return;
      const newest = await tx.guidelineVersion.findFirst({
        where: { companyId, status: 'valid' }, orderBy: { version: 'desc' },
      });
      if (!newest) return;
      await tx.company.update({
        where: { id: companyId },
        data: { guidelineText: newest.content, guidelineFileName: newest.fileName, guidelineUpdatedAt: now, currentGuidelineVersionId: newest.id },
      });
    });
  }
}
