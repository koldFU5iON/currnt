-- AlterTable
ALTER TABLE "user" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "LlmUsageLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmUsageLog_profileId_idx" ON "LlmUsageLog"("profileId");

-- CreateIndex
CREATE INDEX "LlmUsageLog_profileId_createdAt_idx" ON "LlmUsageLog"("profileId", "createdAt");

-- AddForeignKey
ALTER TABLE "LlmUsageLog" ADD CONSTRAINT "LlmUsageLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
