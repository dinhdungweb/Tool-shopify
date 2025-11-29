const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDeletedProductMappings() {
  try {
    console.log('🧹 Cleaning mappings for deleted Nhanh products...\n');

    // Get all mappings
    const mappings = await prisma.productMapping.findMany({
      select: {
        id: true,
        nhanhProductId: true,
        nhanhProductName: true,
        syncStatus: true,
        syncError: true,
      },
    });

    console.log(`📊 Found ${mappings.length} total mappings\n`);

    // Find mappings with "not found" errors
    const deletedMappings = mappings.filter(m => 
      m.syncError && m.syncError.includes('not found in Nhanh.vn')
    );

    console.log(`🔍 Found ${deletedMappings.length} mappings with "not found" errors:\n`);

    if (deletedMappings.length === 0) {
      console.log('✅ No deleted product mappings found!');
      return;
    }

    // Show details
    deletedMappings.forEach((m, i) => {
      console.log(`${i + 1}. ${m.nhanhProductName}`);
      console.log(`   - Nhanh ID: ${m.nhanhProductId}`);
      console.log(`   - Status: ${m.syncStatus}`);
      console.log(`   - Error: ${m.syncError?.substring(0, 80)}...`);
      console.log('');
    });

    // Ask for confirmation
    console.log(`\n⚠️  Do you want to delete these ${deletedMappings.length} mappings?`);
    console.log('   These products no longer exist on Nhanh.vn');
    console.log('   Run this script with --confirm flag to delete\n');

    // Check for --confirm flag
    const shouldDelete = process.argv.includes('--confirm');

    if (!shouldDelete) {
      console.log('💡 To delete these mappings, run:');
      console.log('   node clean-deleted-product-mappings.js --confirm');
      return;
    }

    // Delete mappings
    console.log('\n🗑️  Deleting mappings...');
    const mappingIds = deletedMappings.map(m => m.id);
    
    const result = await prisma.productMapping.deleteMany({
      where: {
        id: { in: mappingIds },
      },
    });

    console.log(`✅ Deleted ${result.count} mappings`);
    console.log('\n💡 These products can be re-matched if they are re-added to Nhanh');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDeletedProductMappings();
