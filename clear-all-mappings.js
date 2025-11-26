// Clear all customer mappings to test new auto-match
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearAllMappings() {
  console.log('🗑️  Clearing all customer mappings...\n');
  
  try {
    // Count current mappings
    const count = await prisma.customerMapping.count();
    console.log(`Found ${count} existing mappings`);
    
    if (count === 0) {
      console.log('✅ No mappings to delete');
      return;
    }
    
    // Delete all mappings
    const result = await prisma.customerMapping.deleteMany({});
    
    console.log(`\n✅ Deleted ${result.count} mappings`);
    console.log('\n🎯 Ready to test new auto-match!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

clearAllMappings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
