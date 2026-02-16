-- CreateTable
CREATE TABLE "Eco" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "audioUrl" TEXT,
    "transcriptionText" TEXT,
    "summaryText" TEXT,
    "folder" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Eco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Eco_userId_idx" ON "Eco"("userId");

-- CreateIndex
CREATE INDEX "Eco_archived_idx" ON "Eco"("archived");

-- AddForeignKey
ALTER TABLE "Eco" ADD CONSTRAINT "Eco_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
