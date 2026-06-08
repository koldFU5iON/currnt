/*
  Warnings:

  - Added the required column `updatedAt` to the `PrepDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PrepInterviewer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PrepDocument" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PrepInterviewer" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
