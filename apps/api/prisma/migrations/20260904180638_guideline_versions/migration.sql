-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "currentGuidelineVersionId" TEXT;

-- CreateTable
CREATE TABLE "GuidelineVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "fileName" TEXT,
    "contentHash" TEXT NOT NULL,
    "byteSize" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidelineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuidelineVersion_companyId_version_key" ON "GuidelineVersion"("companyId", "version");

-- CreateIndex
CREATE INDEX "GuidelineVersion_companyId_createdAt_idx" ON "GuidelineVersion"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Company_currentGuidelineVersionId_key" ON "Company"("currentGuidelineVersionId");

-- AddForeignKey
ALTER TABLE "GuidelineVersion" ADD CONSTRAINT "GuidelineVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_currentGuidelineVersionId_fkey" FOREIGN KEY ("currentGuidelineVersionId") REFERENCES "GuidelineVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
