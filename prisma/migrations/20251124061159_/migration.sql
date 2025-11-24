-- CreateTable
CREATE TABLE "pull_progress" (
    "id" TEXT NOT NULL DEFAULT 'nhanh_customers',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nextCursor" JSONB,
    "totalPulled" INTEGER NOT NULL DEFAULT 0,
    "lastPulledAt" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pull_progress_pkey" PRIMARY KEY ("id")
);
