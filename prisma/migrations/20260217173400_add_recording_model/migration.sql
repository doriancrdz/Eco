-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "audioUrl" TEXT,
    "audioBlobSize" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "mimeType" TEXT,
    "transcriptionText" TEXT,
    "summaryJson" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recording_userId_idx" ON "Recording"("userId");

-- CreateIndex
CREATE INDEX "Recording_status_idx" ON "Recording"("status");

-- CreateIndex
CREATE INDEX "Recording_createdAt_idx" ON "Recording"("createdAt");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
