-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "jobAnalysedAt" TIMESTAMP(3),
ADD COLUMN     "jobAnalysis" JSONB;
