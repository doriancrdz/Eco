-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingMode" TEXT,
ADD COLUMN     "commitmentEndAt" TIMESTAMP(3),
ADD COLUMN     "stripePriceId" TEXT;
