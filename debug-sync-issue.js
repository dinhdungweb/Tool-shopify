const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugSyncIssue() {
  try {
    console.log('🔍 Debugging sync issue...\n');

    // Get a few mapped products with PENDING status
    const mappings = await prisma.productMapping.findMany({
      where: {
        syncStatus: 'PENDING',
      },
      take: 5,
      include: {
        nhanhProduct: true,
      },
    });

    console.log(`📊 Found ${mappings.length} PENDING mappings\n`);

    for (const mapping of mappings) {
      console.log('─'.repeat(80));
      console.log(`\n📦 Mapping ID: ${mapping.id}`);
      console.log(`   Nhanh Product: ${mapping.nhanhProductName}`);
      console.log(`   Nhanh Product ID: ${mapping.nhanhProductId}`);
      console.log(`   Nhanh SKU: ${mapping.nhanhSku || 'N/A'}`);
      console.log(`   Nhanh Barcode: ${mapping.nhanhBarcode || 'N/A'}`);
      
      console.log(`\n   Shopify Product ID: ${mapping.shopifyProductId || '❌ NULL'}`);
      console.log(`   Shopify Variant ID: ${mapping.shopifyVariantId || '❌ NULL'}`);
      console.log(`   Shopify Product Title: ${mapping.shopifyProductTitle || 'N/A'}`);
      console.log(`   Shopify SKU: ${mapping.shopifySku || 'N/A'}`);
      
      console.log(`\n   Sync Status: ${mapping.syncStatus}`);
      console.log(`   Sync Error: ${mapping.syncError || 'None'}`);
      
      // Check if Shopify product exists in database
      if (mapping.shopifyProductId) {
        const shopifyProduct = await prisma.shopifyProduct.findUnique({
          where: { id: mapping.shopifyProductId },
        });
        
        if (shopifyProduct) {
          console.log(`\n   ✅ Shopify Product EXISTS in database`);
          console.log(`      - Title: ${shopifyProduct.title}`);
          console.log(`      - Variant ID: ${shopifyProduct.variantId || '❌ NULL'}`);
          console.log(`      - SKU: ${shopifyProduct.sku || 'N/A'}`);
          console.log(`      - Inventory: ${shopifyProduct.inventoryQuantity}`);
        } else {
          console.log(`\n   ❌ Shopify Product NOT FOUND in database!`);
          console.log(`      This is the problem! Mapping points to non-existent product.`);
        }
      } else {
        console.log(`\n   ❌ No shopifyProductId in mapping!`);
      }
      
      // Check validation for sync
      const canSync = mapping.shopifyProductId && mapping.shopifyVariantId;
      console.log(`\n   Can Sync: ${canSync ? '✅ YES' : '❌ NO'}`);
      
      if (!canSync) {
        const reasons = [];
        if (!mapping.shopifyProductId) reasons.push('Missing shopifyProductId');
        if (!mapping.shopifyVariantId) reasons.push('Missing shopifyVariantId');
        console.log(`   Reasons: ${reasons.join(', ')}`);
      }
      
      console.log('\n');
    }

    // Summary
    console.log('─'.repeat(80));
    console.log('\n📊 Summary:\n');
    
    const totalMappings = await prisma.productMapping.count();
    const withShopifyId = await prisma.productMapping.count({
      where: { shopifyProductId: { not: null } },
    });
    const withVariantId = await prisma.productMapping.count({
      where: { shopifyVariantId: { not: null } },
    });
    const withBoth = await prisma.productMapping.count({
      where: {
        shopifyProductId: { not: null },
        shopifyVariantId: { not: null },
      },
    });
    
    console.log(`   Total mappings: ${totalMappings}`);
    console.log(`   With shopifyProductId: ${withShopifyId}`);
    console.log(`   With shopifyVariantId: ${withVariantId}`);
    console.log(`   With BOTH IDs: ${withBoth}`);
    console.log(`   Missing IDs: ${totalMappings - withBoth}`);
    
    // Check for orphaned mappings (pointing to non-existent Shopify products)
    const mappingsWithShopifyId = await prisma.productMapping.findMany({
      where: { shopifyProductId: { not: null } },
      select: { id: true, shopifyProductId: true },
    });
    
    let orphaned = 0;
    for (const m of mappingsWithShopifyId) {
      const exists = await prisma.shopifyProduct.findUnique({
        where: { id: m.shopifyProductId },
      });
      if (!exists) orphaned++;
    }
    
    console.log(`   Orphaned mappings (pointing to deleted products): ${orphaned}`);
    
    if (orphaned > 0) {
      console.log(`\n⚠️  WARNING: ${orphaned} mappings point to non-existent Shopify products!`);
      console.log(`   This happens when Shopify products are deleted but mappings remain.`);
      console.log(`   Solution: Run "node clear-product-mappings.js" and re-match.`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSyncIssue();
