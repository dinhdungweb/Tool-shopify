const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVariantIds() {
  try {
    // Check some Shopify products
    const products = await prisma.shopifyProduct.findMany({
      take: 10,
      select: {
        id: true,
        title: true,
        variantId: true,
        sku: true,
      },
    });

    console.log('\n📦 Shopify Products:');
    console.log(JSON.stringify(products, null, 2));

    // Check product mappings
    const mappings = await prisma.productMapping.findMany({
      take: 10,
      select: {
        id: true,
        nhanhProductName: true,
        shopifyProductId: true,
        shopifyVariantId: true,
        syncStatus: true,
      },
    });

    console.log('\n🔗 Product Mappings:');
    console.log(JSON.stringify(mappings, null, 2));

    // Count mappings without variantId
    const missingVariantId = await prisma.productMapping.count({
      where: {
        shopifyProductId: { not: null },
        shopifyVariantId: null,
      },
    });

    console.log(`\n⚠️  Mappings with shopifyProductId but NO shopifyVariantId: ${missingVariantId}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVariantIds();
