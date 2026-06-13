-- CreateTable
CREATE TABLE "JobBoardSource" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobBoardSource_pkey" PRIMARY KEY ("id")
);

-- AlterTable: make watchId nullable, add boardSourceId and salary
ALTER TABLE "DiscoveredJob"
    ALTER COLUMN "watchId" DROP NOT NULL,
    ADD COLUMN "boardSourceId" TEXT,
    ADD COLUMN "salary" TEXT;

-- AlterTable: add jobHuntSearch and jobBoardApiKeys to UserSettings
ALTER TABLE "UserSettings"
    ADD COLUMN "jobHuntSearch" JSONB,
    ADD COLUMN "jobBoardApiKeys" JSONB;

-- Drop the old NOT NULL FK constraint and re-add as nullable
ALTER TABLE "DiscoveredJob" DROP CONSTRAINT IF EXISTS "DiscoveredJob_watchId_fkey";
ALTER TABLE "DiscoveredJob" ADD CONSTRAINT "DiscoveredJob_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "CompanyWatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "JobBoardSource_profileId_provider_key" ON "JobBoardSource"("profileId", "provider");

-- CreateIndex
CREATE INDEX "JobBoardSource_profileId_idx" ON "JobBoardSource"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredJob_boardSourceId_externalId_key" ON "DiscoveredJob"("boardSourceId", "externalId");

-- CreateIndex
CREATE INDEX "DiscoveredJob_boardSourceId_idx" ON "DiscoveredJob"("boardSourceId");

-- AddForeignKey
ALTER TABLE "JobBoardSource" ADD CONSTRAINT "JobBoardSource_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredJob" ADD CONSTRAINT "DiscoveredJob_boardSourceId_fkey" FOREIGN KEY ("boardSourceId") REFERENCES "JobBoardSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
