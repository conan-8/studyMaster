-- CreateEnum
CREATE TYPE "ReviewDecisionType" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ReviewDecision" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "decision" "ReviewDecisionType" NOT NULL,
    "reason" TEXT,
    "editedJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewDecision_questionId_idx" ON "ReviewDecision"("questionId");

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
