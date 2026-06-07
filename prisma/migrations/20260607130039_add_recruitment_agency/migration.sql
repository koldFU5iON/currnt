-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "isRecruitmentAgency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recruiterName" TEXT;
