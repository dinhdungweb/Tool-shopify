const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkShopifyData() {
  try {
    console.log('🔍 Checking Shopify customer data...\n');

    // Check specific customer
    const customer = await prisma.shopifyCustomer.findFirst({
      where: {
        OR: [
          { id: 'gid://shopify/Customer/6966281797853' },
          { email: 'phambahung73@gmail.com' },
        ]
      }
    });

    if (customer) {
      console.log('✅ Found customer in database:');
      console.log(`   ID: ${customer.id}`);
      console.log(`   Name: ${customer.firstName} ${customer.lastName}`);
      console.log(`   Email: ${customer.email}`);
      console.log(`   Phone: ${customer.phone || 'NULL'}`);
      console.log(`   Default Address Phone: ${customer.defaultAddressPhone || 'NULL'}`);
      console.log(`   Last Pulled: ${customer.lastPulledAt}`);
      console.log();

      if (!customer.defaultAddressPhone) {
        console.log('⚠️  defaultAddressPhone is NULL!');
        console.log('   This customer was pulled before the field was added.');
        console.log('   Solution: Pull Shopify customers again to update.\n');
      }
    } else {
      console.log('❌ Customer not found in database\n');
    }

    // Check overall stats
    console.log('📊 Overall Shopify customer stats:');
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(phone) as has_phone,
        COUNT("defaultAddressPhone") as has_default_phone,
        COUNT(note) as has_note
      FROM shopify_customers;
    `;

    const stat = stats[0];
    console.log(`   Total customers: ${stat.total}`);
    console.log(`   Has phone: ${stat.has_phone} (${((stat.has_phone / stat.total) * 100).toFixed(1)}%)`);
    console.log(`   Has defaultAddressPhone: ${stat.has_default_phone} (${((stat.has_default_phone / stat.total) * 100).toFixed(1)}%)`);
    console.log(`   Has note: ${stat.has_note} (${((stat.has_note / stat.total) * 100).toFixed(1)}%)`);
    console.log();

    if (stat.has_default_phone === 0) {
      console.log('🚨 PROBLEM: No customers have defaultAddressPhone!');
      console.log('   The field exists in schema but data is not populated.');
      console.log('   You need to pull Shopify customers again.\n');
    }

    // Check when last pulled
    const lastPulled = await prisma.shopifyCustomer.findFirst({
      orderBy: { lastPulledAt: 'desc' },
      select: { lastPulledAt: true }
    });

    if (lastPulled) {
      const hoursSince = (Date.now() - lastPulled.lastPulledAt.getTime()) / (1000 * 60 * 60);
      console.log(`⏰ Last pull: ${lastPulled.lastPulledAt.toLocaleString()}`);
      console.log(`   (${hoursSince.toFixed(1)} hours ago)\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkShopifyData();
