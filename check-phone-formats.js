// Check phone number formats in both databases
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPhoneFormats() {
  console.log('📱 Checking phone number formats...\n');
  
  try {
    // Sample Nhanh phones
    const nhanhSamples = await prisma.nhanhCustomer.findMany({
      where: { phone: { not: null } },
      select: { id: true, name: true, phone: true },
      take: 10
    });
    
    console.log('Nhanh.vn phone samples:');
    nhanhSamples.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name}: "${c.phone}"`);
    });
    
    // Sample Shopify phones
    const shopifySamples = await prisma.shopifyCustomer.findMany({
      where: { phone: { not: null } },
      select: { id: true, firstName: true, lastName: true, phone: true },
      take: 10
    });
    
    console.log('\nShopify phone samples:');
    shopifySamples.forEach((c, i) => {
      console.log(`${i + 1}. ${c.firstName} ${c.lastName}: "${c.phone}"`);
    });
    
    // Try simple exact match
    console.log('\n🔍 Testing simple exact match...');
    const exactMatchQuery = `
      SELECT 
        nc.name as nhanh_name,
        nc.phone as nhanh_phone,
        sc."firstName" as shopify_first,
        sc."lastName" as shopify_last,
        sc.phone as shopify_phone
      FROM nhanh_customers nc
      INNER JOIN shopify_customers sc ON nc.phone = sc.phone
      WHERE nc.phone IS NOT NULL AND sc.phone IS NOT NULL
      LIMIT 10
    `;
    
    const exactMatches = await prisma.$queryRawUnsafe(exactMatchQuery);
    console.log(`Found ${exactMatches.length} exact matches`);
    
    if (exactMatches.length > 0) {
      console.log('\nExact matches:');
      exactMatches.forEach((m, i) => {
        console.log(`${i + 1}. "${m.nhanh_phone}" = "${m.shopify_phone}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPhoneFormats()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
