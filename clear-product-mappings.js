/**
 * Clear all product mappings from database
 * Usage: node clear-product-mappings.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function clearProductMappings() {
  try {
    console.log("🗑️  Starting to clear product mappings...\n");

    // Count before deletion
    const beforeCount = await prisma.productMapping.count();
    console.log(`📊 Found ${beforeCount} product mappings in database`);

    if (beforeCount === 0) {
      console.log("✅ No mappings to delete");
      return;
    }

    // Show breakdown by status
    const statusCounts = await prisma.productMapping.groupBy({
      by: ['syncStatus'],
      _count: true,
    });

    console.log("\n📊 Breakdown by status:");
    statusCounts.forEach(({ syncStatus, _count }) => {
      console.log(`   - ${syncStatus}: ${_count}`);
    });

    // Confirm deletion
    console.log("\n⚠️  WARNING: This will delete ALL product mappings!");
    console.log("⚠️  This includes sync history and mapping relationships!");
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...\n");
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete all product mappings
    console.log("🗑️  Deleting all product mappings...");
    const result = await prisma.productMapping.deleteMany({});
    
    console.log(`✅ Deleted ${result.count} product mappings`);

    // Verify deletion
    const afterCount = await prisma.productMapping.count();
    console.log(`📊 Remaining mappings: ${afterCount}`);

    if (afterCount === 0) {
      console.log("\n✅ All product mappings cleared successfully!");
      console.log("\n💡 Note: Shopify and Nhanh products are still in database.");
      console.log("   Use clear-shopify-products.js or clear-nhanh-products.js to remove them.");
    } else {
      console.log(`\n⚠️  Warning: ${afterCount} mappings still remain`);
    }

  } catch (error) {
    console.error("❌ Error clearing product mappings:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearProductMappings();
