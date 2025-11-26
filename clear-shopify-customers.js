// Clear all Shopify customers and reset pull progress
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearShopifyCustomers() {
  console.log('🗑️  Clearing Shopify customers...\n');
  
  try {
    // Count current customers
    const count = await prisma.shopifyCustomer.count();
    console.log(`Found ${count} Shopify customers`);
    
    if (count === 0) {
      console.log('✅ No customers to delete');
    } else {
      // Delete all Shopify customers
      const result = await prisma.shopifyCustomer.deleteMany({});
      console.log(`✅ Deleted ${result.count} Shopify customers`);
    }
    
    // Reset pull progress
    console.log('\n🔄 Resetting pull progress...');
    await prisma.pullProgress.deleteMany({
      where: {
        id: 'shopify_customers'
      }
    });
    console.log('✅ Pull progress reset');
    
    console.log('\n🎯 Ready to pull Shopify customers again!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

clearShopifyCustomers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
