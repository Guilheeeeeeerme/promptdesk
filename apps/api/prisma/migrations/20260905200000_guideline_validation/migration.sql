CREATE TYPE "GuidelineValidationStatus" AS ENUM ('pending', 'valid', 'invalid', 'provider_error');

ALTER TABLE "GuidelineVersion"
  ADD COLUMN "status" "GuidelineValidationStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "validationReason" TEXT,
  ADD COLUMN "validationStartedAt" TIMESTAMP(3),
  ADD COLUMN "validatedAt" TIMESTAMP(3);

UPDATE "GuidelineVersion" SET "status" = 'valid', "validatedAt" = "createdAt";

CREATE INDEX "GuidelineVersion_companyId_status_version_idx"
  ON "GuidelineVersion"("companyId", "status", "version");
