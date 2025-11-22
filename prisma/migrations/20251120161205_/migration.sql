-- CreateTable
CREATE TABLE "auto_sync_config" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule" TEXT NOT NULL DEFAULT '0 */6 * * *',

    CONSTRAINT "auto_sync_config_pkey" PRIMARY KEY ("id")
);
