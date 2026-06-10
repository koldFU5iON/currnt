-- CreateTable
CREATE TABLE "CompanyWatch" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "careersUrl" TEXT,
    "atsProvider" TEXT NOT NULL DEFAULT 'unknown',
    "boardSlug" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveredJob" (
    "id" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "url" TEXT,
    "postedAt" TIMESTAMP(3),
    "description" TEXT,
    "fitScore" DOUBLE PRECISION,
    "fitLabel" TEXT,
    "fitJustification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "importedJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveredJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyWatch_profileId_idx" ON "CompanyWatch"("profileId");

-- CreateIndex
CREATE INDEX "CompanyWatch_profileId_status_idx" ON "CompanyWatch"("profileId", "status");

-- CreateIndex
CREATE INDEX "DiscoveredJob_profileId_idx" ON "DiscoveredJob"("profileId");

-- CreateIndex
CREATE INDEX "DiscoveredJob_profileId_status_idx" ON "DiscoveredJob"("profileId", "status");

-- CreateIndex
CREATE INDEX "DiscoveredJob_watchId_idx" ON "DiscoveredJob"("watchId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredJob_watchId_externalId_key" ON "DiscoveredJob"("watchId", "externalId");

-- AddForeignKey
ALTER TABLE "CompanyWatch" ADD CONSTRAINT "CompanyWatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredJob" ADD CONSTRAINT "DiscoveredJob_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "CompanyWatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredJob" ADD CONSTRAINT "DiscoveredJob_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
