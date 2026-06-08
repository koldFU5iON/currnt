-- CreateTable
CREATE TABLE "InterviewPrepSession" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "jobTitle" TEXT,
    "jobApplicationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewPrepSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Prep Notes',
    "sections" JSONB NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepDocument" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "docType" TEXT NOT NULL DEFAULT 'other',
    "content" TEXT NOT NULL,
    "aiAnalysis" JSONB,
    "aiAnalysedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepInterviewer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "linkedInText" TEXT,
    "notes" TEXT,
    "aiAnalysis" JSONB,
    "aiAnalysedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepInterviewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewPrepSession_profileId_idx" ON "InterviewPrepSession"("profileId");

-- CreateIndex
CREATE INDEX "InterviewPrepSession_jobApplicationId_idx" ON "InterviewPrepSession"("jobApplicationId");

-- CreateIndex
CREATE INDEX "PrepNote_sessionId_idx" ON "PrepNote"("sessionId");

-- CreateIndex
CREATE INDEX "PrepDocument_sessionId_idx" ON "PrepDocument"("sessionId");

-- CreateIndex
CREATE INDEX "PrepInterviewer_sessionId_idx" ON "PrepInterviewer"("sessionId");

-- AddForeignKey
ALTER TABLE "InterviewPrepSession" ADD CONSTRAINT "InterviewPrepSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPrepSession" ADD CONSTRAINT "InterviewPrepSession_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepNote" ADD CONSTRAINT "PrepNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewPrepSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepDocument" ADD CONSTRAINT "PrepDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewPrepSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepInterviewer" ADD CONSTRAINT "PrepInterviewer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewPrepSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
