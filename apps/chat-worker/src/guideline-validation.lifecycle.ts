import type { GuidelineValidationEvent } from "./chat.constants";

type ValidationStatus = "valid" | "invalid" | "provider_error";

type ClaimedVersion = {
  id: string;
  companyId: string;
  version: number;
  content: string;
  status: string;
};

type NewestValidVersion = {
  id: string;
  version: number;
  content: string;
  fileName: string | null;
};

type LifecycleTransaction = {
  guidelineVersion: {
    updateMany(args: unknown): Promise<{ count: number }>;
    findFirst(args: unknown): Promise<NewestValidVersion | null>;
  };
  company: {
    update(args: {
      where: { id: string };
      data: {
        guidelineText: string;
        guidelineFileName: string | null;
        guidelineUpdatedAt: Date;
        currentGuidelineVersionId: string;
      };
    }): Promise<unknown>;
  };
};

export type GuidelineLifecycleStore = {
  guidelineVersion: {
    updateMany(args: unknown): Promise<{ count: number }>;
    findUnique(args: unknown): Promise<ClaimedVersion | null>;
  };
  $transaction<T>(callback: (tx: LifecycleTransaction) => Promise<T>): Promise<T>;
};

type Validate = (input: {
  content: string;
}) => Promise<{ status: ValidationStatus; reason?: string }>;

type Publish = (event: GuidelineValidationEvent) => Promise<void>;

export async function executeGuidelineValidation(
  prisma: GuidelineLifecycleStore,
  data: { companyId: string; versionId: string },
  validate: Validate,
  publish: Publish,
): Promise<void> {
  const { companyId, versionId } = data;
  const startedAt = new Date();
  const claim = await prisma.guidelineVersion.updateMany({
    where: { id: versionId, companyId, status: "pending" },
    data: { status: "processing", validationStartedAt: startedAt },
  });
  if (claim.count !== 1) return;

  const version = await prisma.guidelineVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      companyId: true,
      version: true,
      content: true,
      status: true,
    },
  });
  if (!version || version.companyId !== companyId) return;

  await publish({
    type: "guideline_validation",
    companyId,
    versionId,
    version: version.version,
    status: "processing",
    occurredAt: startedAt.toISOString(),
  });

  let result: Awaited<ReturnType<Validate>>;
  try {
    result = await validate({ content: version.content });
  } catch (error) {
    await prisma.guidelineVersion.updateMany({
      where: { id: versionId, companyId, status: "processing" },
      data: { status: "pending", validationStartedAt: null },
    });
    throw error;
  }

  const completedAt = new Date();
  const completion = await prisma.$transaction(async (tx) => {
    const applied = await tx.guidelineVersion.updateMany({
      where: { id: versionId, companyId, status: "processing" },
      data: {
        status: result.status,
        validationReason: result.reason ?? null,
        validatedAt: completedAt,
      },
    });
    if (applied.count !== 1) return null;

    if (result.status !== "valid") {
      return { activeVersion: null as number | null };
    }

    const newest = await tx.guidelineVersion.findFirst({
      where: { companyId, status: "valid" },
      orderBy: { version: "desc" },
    });
    if (!newest) return { activeVersion: null as number | null };

    await tx.company.update({
      where: { id: companyId },
      data: {
        guidelineText: newest.content,
        guidelineFileName: newest.fileName,
        guidelineUpdatedAt: completedAt,
        currentGuidelineVersionId: newest.id,
      },
    });
    return { activeVersion: newest.version as number | null };
  });
  if (!completion) return;

  await publish({
    type: "guideline_validation",
    companyId,
    versionId,
    version: version.version,
    status: result.status,
    reason: result.reason ?? null,
    activeVersion: completion.activeVersion,
    occurredAt: completedAt.toISOString(),
  });
}
