// Check customers with phone but not mapped
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUnmappedCustomers() {
  console.log('🔍 Checking unmapped customers with phone numbers...\n');
  
  try {
    // Count Nhanh customers with phone
    const totalNhanhWithPhone = await prisma.nhanhCustomer.count({
      where: { phone: { not: null } }
    });
    console.log(`Total Nhanh customers with phone: ${totalNhanhWithPhone}`);
    
    // Count Shopify customers with phone
    const totalShopifyWithPhone = await prisma.shopifyCustomer.count({
      where: { phone: { not: null } }
    });
    console.log(`Total Shopify customers with phone: ${totalShopifyWithPhone}`);
    
    // Count mapped
    const totalMapped = await prisma.customerMapping.count();
    console.log(`Total mapped: ${totalMapped}`);
    
    // Count unmapped Nhanh customers with phone
    const unmappedWithPhone = await prisma.nhanhCustomer.count({
      where: {
        phone: { not: null },
        mapping: null
      }
    });
    console.log(`Unmapped Nhanh customers with phone: ${unmappedWithPhone}\n`);
    
    // Check if these unmapped customers have potential matches in Shopify
    console.log('🔍 Checking if unmapped customers have Shopify matches...\n');
    
    const unmappedSamples = await prisma.nhanhCustomer.findMany({
      where: {
        phone: { not: null },
        mapping: null
      },
      select: {
        id: true,
        name: true,
        phone: true
      },
      take: 20
    });
    
    for (const nhanh of unmappedSamples) {
      // Try to find Shopify match manually
      const phone = nhanh.phone;
      const phone84 = phone.startsWith('0') ? '+84' + phone.substring(1) : phone;
      const phone0 = phone.startsWith('+84') ? '0' + phone.substring(3) : phone;
      
      const shopifyMatches = await prisma.shopifyCustomer.findMany({
        where: {
          OR: [
            { phone: phone },
            { phone: phone84 },
            { phone: phone0 }
          ]
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true
        }
      });
      
      if (shopifyMatches.length > 0) {
        console.log(`❓ ${nhanh.name} (${nhanh.phone})`);
        console.log(`   → Found ${shopifyMatches.length} Shopify matches:`);
        shopifyMatches.forEach(s => {
          console.log(`      - ${s.firstName} ${s.lastName} (${s.phone})`);
        });
        console.log('');
      }
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`- Nhanh with phone: ${totalNhanhWithPhone}`);
    console.log(`- Shopify with phone: ${totalShopifyWithPhone}`);
    console.log(`- Mapped: ${totalMapped}`);
    console.log(`- Unmapped (with phone): ${unmappedWithPhone}`);
    console.log(`- Mapping rate: ${((totalMapped / totalNhanhWithPhone) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUnmappedCustomers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
