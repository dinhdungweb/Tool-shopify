// Find exact customer by email
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findCustomer() {
  try {
    const email = "d10168589070@gmail.com";
    console.log(`\n🔍 Searching for customer with email: ${email}\n`);

    const customer = await prisma.shopifyCustomer.findFirst({
      where: {
        email: email
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

    if (!customer) {
      console.log("❌ Customer not found!");
      return;
    }

    console.log("✅ Found customer:");
    console.log(`   - Name: ${customer.firstName} ${customer.lastName}`);
    console.log(`   - Shopify ID: ${customer.id}`);
    console.log(`   - Email: ${customer.email}`);
    console.log(`   - Phone: "${customer.phone || 'N/A'}"`);
    console.log(`   - Address Phone: "${customer.defaultAddressPhone || 'N/A'}"`);
    console.log(`   - Note: "${customer.note || 'N/A'}"`);
    console.log();

    // Check if phone matches
    const searchPhone = "0385890707";
    const phoneVariations = [searchPhone, "84385890707", "385890707"];
    
    console.log("\n🔍 Checking phone matches:");
    console.log(`   Looking for: ${phoneVariations.join(", ")}`);
    
    let matched = false;
    if (phoneVariations.includes(customer.phone)) {
      console.log(`   ✅ MATCH in phone field: "${customer.phone}"`);
      matched = true;
    }
    if (phoneVariations.includes(customer.defaultAddressPhone)) {
      console.log(`   ✅ MATCH in defaultAddressPhone field: "${customer.defaultAddressPhone}"`);
      matched = true;
    }
    if (customer.note) {
      const noteContains = phoneVariations.some(v => customer.note.includes(v));
      if (noteContains) {
        console.log(`   ✅ MATCH in note field`);
        matched = true;
      }
    }
    
    if (!matched) {
      console.log(`   ❌ NO MATCH - Phone not found in any field`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findCustomer();
