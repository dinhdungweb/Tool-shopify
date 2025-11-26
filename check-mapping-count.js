// Check actual mapping count in database
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMappingCount() {
  console.log('📊 Checking mapping count...\n');
  
  try {
    const count = await prisma.customerMapping.count();
    console.log(`Total mappings in database: ${count}`);
    
    // Check by status
    const pending = await prisma.customerMapping.count({
      where: { syncStatus: 'PENDING' }
    });
    const synced = await prisma.customerMapping.count({
      where: { syncStatus: 'SYNCED' }
    });
    const failed = await prisma.customerMapping.count({
      where: { syncStatus: 'FAILED' }
    });
    
    console.log(`\nBy status:`);
    console.log(`- PENDING: ${pending}`);
    console.log(`- SYNCED: ${synced}`);
    console.log(`- FAILED: ${failed}`);
    
    // Show first 5 mappings
    const samples = await prisma.customerMapping.findMany({
      take: 5,
      select: {
        id: true,
        nhanhCustomerName: true,
        shopifyCustomerName: true,
        syncStatus: true,
      }
    });
    
    console.log(`\nSample mappings:`);
    samples.forEach((m, i) => {
      console.log(`${i + 1}. ${m.nhanhCustomerName} → ${m.shopifyCustomerName} (${m.syncStatus})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMappingCount()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
