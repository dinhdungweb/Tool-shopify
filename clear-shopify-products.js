/**
 * Clear all Shopify products from database
 * Usage: node clear-shopify-products.js
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function clearShopifyProducts() {
  try {
    console.log("🗑️  Starting to clear Shopify products...\n");

    // Count before deletion
    const beforeCount = await prisma.shopifyProduct.count();
    console.log(`📊 Found ${beforeCount} Shopify products in database`);

    if (beforeCount === 0) {
      console.log("✅ No products to delete");
      return;
    }

    // Confirm deletion
    console.log("\n⚠️  WARNING: This will delete ALL Shopify products!");
    console.log("Press Ctrl+C to cancel, or wait 3 seconds to continue...\n");
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete all Shopify products
    console.log("🗑️  Deleting all Shopify products...");
    const result = await prisma.shopifyProduct.deleteMany({});
    
    console.log(`✅ Deleted ${result.count} Shopify products`);

    // Verify deletion
    const afterCount = await prisma.shopifyProduct.count();
    console.log(`📊 Remaining products: ${afterCount}`);

    if (afterCount === 0) {
      console.log("\n✅ All Shopify products cleared successfully!");
    } else {
      console.log(`\n⚠️  Warning: ${afterCount} products still remain`);
    }

  } catch (error) {
    console.error("❌ Error clearing Shopify products:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearShopifyProducts();
