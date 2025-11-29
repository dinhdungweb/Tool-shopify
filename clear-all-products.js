const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearAllProducts() {
  try {
    console.log('🗑️  Clearing ALL products data...\n');

    // Count before deletion
    const nhanhCount = await prisma.nhanhProduct.count();
    const shopifyCount = await prisma.shopifyProduct.count();
    const mappingCount = await prisma.productMapping.count();
    const syncLogCount = await prisma.productSyncLog.count();

    console.log('📊 Current data:');
    console.log(`   - Nhanh products: ${nhanhCount}`);
    console.log(`   - Shopify products: ${shopifyCount}`);
    console.log(`   - Product mappings: ${mappingCount}`);
    console.log(`   - Product sync logs: ${syncLogCount}\n`);

    if (nhanhCount === 0 && shopifyCount === 0 && mappingCount === 0) {
      console.log('✅ No products data to clear');
      return;
    }

    console.log('⚠️  WARNING: This will delete ALL products data from database!');
    console.log('⚠️  This includes:');
    console.log('   - All Nhanh products');
    console.log('   - All Shopify products');
    console.log('   - All product mappings');
    console.log('   - All product sync logs\n');

    // Delete in correct order to avoid foreign key constraints
    console.log('🗑️  Deleting product sync logs...');
    const logsResult = await prisma.productSyncLog.deleteMany({});
    console.log(`   ✅ Deleted ${logsResult.count} sync logs`);

    console.log('🗑️  Deleting product mappings...');
    const mappingsResult = await prisma.productMapping.deleteMany({});
    console.log(`   ✅ Deleted ${mappingsResult.count} mappings`);

    console.log('🗑️  Deleting Nhanh products...');
    const nhanhResult = await prisma.nhanhProduct.deleteMany({});
    console.log(`   ✅ Deleted ${nhanhResult.count} Nhanh products`);

    console.log('🗑️  Deleting Shopify products...');
    const shopifyResult = await prisma.shopifyProduct.deleteMany({});
    console.log(`   ✅ Deleted ${shopifyResult.count} Shopify products`);

    console.log('\n✅ All products data cleared successfully!\n');

    // Verify deletion
    const nhanhAfter = await prisma.nhanhProduct.count();
    const shopifyAfter = await prisma.shopifyProduct.count();
    const mappingAfter = await prisma.productMapping.count();
    const syncLogAfter = await prisma.productSyncLog.count();

    console.log('📊 Remaining data:');
    console.log(`   - Nhanh products: ${nhanhAfter}`);
    console.log(`   - Shopify products: ${shopifyAfter}`);
    console.log(`   - Product mappings: ${mappingAfter}`);
    console.log(`   - Product sync logs: ${syncLogAfter}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllProducts();
