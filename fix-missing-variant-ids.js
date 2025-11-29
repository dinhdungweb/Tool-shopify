const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMissingVariantIds() {
  try {
    console.log('🔧 Fixing missing shopifyVariantIds in product mappings...\n');

    // Get all mappings with shopifyProductId but no shopifyVariantId
    const mappings = await prisma.productMapping.findMany({
      where: {
        shopifyProductId: { not: null },
        shopifyVariantId: null,
      },
      select: {
        id: true,
        shopifyProductId: true,
      },
    });

    console.log(`📊 Found ${mappings.length} mappings to fix\n`);

    if (mappings.length === 0) {
      console.log('✅ No mappings need fixing!');
      return;
    }

    let fixed = 0;
    let failed = 0;

    // Update each mapping: set shopifyVariantId = shopifyProductId
    // (In Shopify, each variant has its own ID, and we store variants as products)
    for (const mapping of mappings) {
      try {
        await prisma.productMapping.update({
          where: { id: mapping.id },
          data: {
            shopifyVariantId: mapping.shopifyProductId,
          },
        });
        fixed++;
        
        if (fixed % 50 === 0) {
          console.log(`  ✅ Fixed ${fixed}/${mappings.length}...`);
        }
      } catch (error) {
        console.error(`  ❌ Failed to fix mapping ${mapping.id}:`, error.message);
        failed++;
      }
    }

    console.log(`\n✅ Fix completed!`);
    console.log(`   - Fixed: ${fixed}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Total: ${mappings.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingVariantIds();
