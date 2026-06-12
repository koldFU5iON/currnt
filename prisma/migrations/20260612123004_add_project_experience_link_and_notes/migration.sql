-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "experienceId" TEXT,
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Project_experienceId_idx" ON "Project"("experienceId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE SET NULL ON UPDATE CASCADE;
