// Check Trần Nhật customer details
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCustomer() {
  try {
    console.log("\n🔍 Searching for 'Trần Nhật' customer...\n");

    const customers = await prisma.shopifyCustomer.findMany({
      where: {
        OR: [
          { firstName: { contains: 'Trần' } },
          { lastName: { contains: 'Nhật' } },
          { email: { contains: 'd10168589' } },
        ]
      },
      select: {
        id: true,
        phone: true,
        defaultAddressPhone: true,
        note: true,
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
      console.log(`   - Phone: "${c.phone || 'N/A'}"`);
      console.log(`   - Address Phone: "${c.defaultAddressPhone || 'N/A'}"`);
      console.log(`   - Note: "${c.note || 'N/A'}"`);
      console.log();
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCustomer();
