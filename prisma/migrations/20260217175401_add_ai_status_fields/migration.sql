-- AlterTable
ALTER TABLE "Recording" ADD COLUMN     "aiError" TEXT,
ADD COLUMN     "aiFinishedAt" TIMESTAMP(3),
ADD COLUMN     "aiStartedAt" TIMESTAMP(3),
ADD COLUMN     "aiStatus" TEXT NOT NULL DEFAULT 'IDLE';

-- CreateIndex
CREATE INDEX "Recording_aiStatus_idx" ON "Recording"("aiStatus");
