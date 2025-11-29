const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNhanhProduct() {
  try {
    const productId = '37472334'; // The failing product ID
    
    console.log(`🔍 Checking Nhanh product ${productId}...\n`);
    
    // Check if product exists in local database
    const localProduct = await prisma.nhanhProduct.findUnique({
      where: { id: productId },
    });
    
    if (localProduct) {
      console.log('✅ Product EXISTS in local database:');
      console.log(`   - Name: ${localProduct.name}`);
      console.log(`   - SKU: ${localProduct.sku || 'N/A'}`);
      console.log(`   - Quantity: ${localProduct.quantity}`);
      console.log(`   - Price: ${localProduct.price}`);
      console.log(`   - Last Pulled: ${localProduct.lastPulledAt}`);
    } else {
      console.log('❌ Product NOT FOUND in local database');
      console.log('   This product may have been deleted from Nhanh.vn');
    }
    
    // Check mapping
    const mapping = await prisma.productMapping.findFirst({
      where: { nhanhProductId: productId },
    });
    
    if (mapping) {
      console.log('\n🔗 Mapping exists:');
      console.log(`   - Mapping ID: ${mapping.id}`);
      console.log(`   - Shopify Product: ${mapping.shopifyProductTitle}`);
      console.log(`   - Sync Status: ${mapping.syncStatus}`);
    } else {
      console.log('\n❌ No mapping found for this product');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNhanhProduct();
