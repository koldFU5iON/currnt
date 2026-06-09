-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "chatModel" TEXT;

-- CreateTable
CREATE TABLE "ChatMemory" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMemory_profileId_idx" ON "ChatMemory"("profileId");

-- AddForeignKey
ALTER TABLE "ChatMemory" ADD CONSTRAINT "ChatMemory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
