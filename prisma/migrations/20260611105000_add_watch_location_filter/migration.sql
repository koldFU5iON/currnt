-- AlterTable
ALTER TABLE "CompanyWatch" ADD COLUMN     "includeRemote" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "searchLocations" TEXT[] DEFAULT ARRAY[]::TEXT[];
