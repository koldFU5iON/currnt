-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "JobApplication_profileId_archivedAt_idx" ON "JobApplication"("profileId", "archivedAt");
