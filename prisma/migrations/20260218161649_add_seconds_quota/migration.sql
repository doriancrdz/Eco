-- AlterTable
ALTER TABLE "Recording" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "usageRecorded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "quotaExtraSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quotaResetAt" TIMESTAMP(3),
ADD COLUMN     "quotaSecondsTotal" INTEGER NOT NULL DEFAULT 600,
ADD COLUMN     "quotaSecondsUsed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "secondsUsed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_recordingId_key" ON "UsageEvent"("recordingId");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_idx" ON "UsageEvent"("userId");

-- CreateIndex
CREATE INDEX "UsageEvent_recordingId_idx" ON "UsageEvent"("recordingId");

-- CreateIndex
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Recording_usageRecorded_idx" ON "Recording"("usageRecorded");

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;
