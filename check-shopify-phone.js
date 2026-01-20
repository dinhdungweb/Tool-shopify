// Check exact phone format in Shopify database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPhone() {
  try {
    console.log("\n🔍 Searching Shopify customers with phone containing '385890707'...\n");

    // Search using contains (like UI does)
    const customers = await prisma.shopifyCustomer.findMany({
      where: {
        OR: [
          { phone: { contains: '385890707' } },
          { defaultAddressPhone: { contains: '385890707' } },
        ]
      },
      select: {
        id: true,
        phone: true,
        defaultAddressPhone: true,
        email: true,
        firstName: true,
        lastName: true,
      }
    });

    console.log(`Found ${customers.length} customers:\n`);

    customers.forEach((c, i) => {
      console.log(`${i + 1}. ${c.firstName} ${c.lastName}`);
      console.log(`   - Shopify ID: ${c.id}`);
      console.log(`   - Email: ${c.email || 'N/A'}`);
      console.log(`   - Phone: "${c.phone}" (length: ${c.phone?.length || 0})`);
      console.log(`   - Address Phone: "${c.defaultAddressPhone}" (length: ${c.defaultAddressPhone?.length || 0})`);
      
      // Show exact characters
      if (c.phone) {
        console.log(`   - Phone bytes: ${Buffer.from(c.phone).toString('hex')}`);
      }
      if (c.defaultAddressPhone) {
        console.log(`   - Address Phone bytes: ${Buffer.from(c.defaultAddressPhone).toString('hex')}`);
      }
      console.log();
    });

    // Now check exact matches
    console.log("\n🎯 Checking exact matches with variations...\n");
    const variations = ['0385890707', '84385890707', '385890707'];
    
    for (const variation of variations) {
      const exactMatch = await prisma.shopifyCustomer.findMany({
        where: {
          OR: [
            { phone: variation },
            { defaultAddressPhone: variation },
          ]
        },
        select: {
          id: true,
          phone: true,
          defaultAddressPhone: true,
          firstName: true,
          lastName: true,
        }
      });

      console.log(`Variation "${variation}": ${exactMatch.length} exact matches`);
      if (exactMatch.length > 0) {
        exactMatch.forEach(c => {
          console.log(`   - ${c.firstName} ${c.lastName} (phone: "${c.phone}", address: "${c.defaultAddressPhone}")`);
        });
      }
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhone();
