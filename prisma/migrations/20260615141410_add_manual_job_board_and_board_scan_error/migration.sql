-- AlterTable
ALTER TABLE "JobBoardSource" ADD COLUMN     "lastScanError" TEXT;

-- CreateTable
CREATE TABLE "ManualJobBoard" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualJobBoard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualJobBoard_profileId_idx" ON "ManualJobBoard"("profileId");

-- AddForeignKey
ALTER TABLE "ManualJobBoard" ADD CONSTRAINT "ManualJobBoard_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
