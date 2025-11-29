const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findDuplicates() {
  try {
    const phone = "0358259084";
    console.log(`🔍 Finding all Shopify customers with phone: ${phone}\n`);

    const customers = await prisma.shopifyCustomer.findMany({
      where: {
        OR: [
          { phone: { in: [phone, "84358259084"] } },
          { defaultAddressPhone: { in: [phone, "84358259084"] } },
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        defaultAddressPhone: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${customers.length} customers:\n`);
    
    customers.forEach((c, i) => {
      console.log(`${i + 1}. ${c.firstName} ${c.lastName}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Email: ${c.email || 'N/A'}`);
      console.log(`   Phone: ${c.phone || 'N/A'}`);
      console.log(`   DefaultAddressPhone: ${c.defaultAddressPhone || 'N/A'}`);
      console.log(`   Created: ${c.createdAt.toLocaleString()}`);
      console.log();
    });

    if (customers.length > 1) {
      console.log('⚠️  DUPLICATE PHONE NUMBERS!');
      console.log('   Auto-match skips duplicates for safety.');
      console.log('   You need to manually map the correct customer.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findDuplicates();
