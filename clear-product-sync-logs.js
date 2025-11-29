const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearProductSyncLogs() {
  try {
    console.log('🗑️  Clearing product sync logs...\n');

    // Count before deletion
    const countBefore = await prisma.productSyncLog.count();
    console.log(`📊 Found ${countBefore} product sync logs\n`);

    if (countBefore === 0) {
      console.log('✅ No product sync logs to clear');
      return;
    }

    // Delete all product sync logs
    const result = await prisma.productSyncLog.deleteMany({});

    console.log(`✅ Deleted ${result.count} product sync logs\n`);

    // Verify deletion
    const countAfter = await prisma.productSyncLog.count();
    console.log(`📊 Remaining product sync logs: ${countAfter}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearProductSyncLogs();
