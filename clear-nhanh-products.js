const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearNhanhProducts() {
  try {
    console.log('🗑️  Clearing Nhanh products...\n');

    // Count before deletion
    const countBefore = await prisma.nhanhProduct.count();
    console.log(`📊 Found ${countBefore} Nhanh products\n`);

    if (countBefore === 0) {
      console.log('✅ No Nhanh products to clear');
      return;
    }

    // Confirm deletion
    console.log('⚠️  WARNING: This will delete ALL Nhanh products from database!');
    console.log('⚠️  Product mappings will also be deleted (cascade).\n');

    // Delete all Nhanh products (will cascade delete product mappings)
    const result = await prisma.nhanhProduct.deleteMany({});

    console.log(`✅ Deleted ${result.count} Nhanh products`);
    console.log('✅ Associated product mappings were also deleted (cascade)\n');

    // Verify deletion
    const countAfter = await prisma.nhanhProduct.count();
    console.log(`📊 Remaining Nhanh products: ${countAfter}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearNhanhProducts();
