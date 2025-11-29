const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function searchPhone(phone) {
  try {
    console.log(`🔍 Searching for phone: ${phone}\n`);

    // Normalize phone variations
    const phoneVariations = [
      phone,
      phone.replace(/[\s\-\(\)\+]/g, ""),
    ];
    
    if (phone.startsWith("0")) {
      phoneVariations.push("84" + phone.substring(1));
    } else if (phone.startsWith("84")) {
      phoneVariations.push("0" + phone.substring(2));
    }

    console.log(`📱 Searching variations: ${phoneVariations.join(", ")}\n`);

    // Search in Nhanh customers
    console.log("🔎 Searching in Nhanh customers...");
    const nhanhCustomers = await prisma.nhanhCustomer.findMany({
      where: {
        phone: { in: phoneVariations }
      },
      include: {
        mapping: true
      }
    });

    if (nhanhCustomers.length > 0) {
      console.log(`✅ Found ${nhanhCustomers.length} Nhanh customer(s):`);
      nhanhCustomers.forEach(c => {
        console.log(`   - ID: ${c.id}`);
        console.log(`     Name: ${c.name}`);
        console.log(`     Phone: ${c.phone}`);
        console.log(`     Email: ${c.email || 'N/A'}`);
        console.log(`     Mapped: ${c.mapping ? 'YES' : 'NO'}`);
        if (c.mapping) {
          console.log(`     Mapping ID: ${c.mapping.id}`);
          console.log(`     Shopify Customer ID: ${c.mapping.shopifyCustomerId}`);
          console.log(`     Sync Status: ${c.mapping.syncStatus}`);
        }
        console.log();
      });
    } else {
      console.log("   ❌ Not found in Nhanh customers\n");
    }

    // Search in Shopify customers
    console.log("🔎 Searching in Shopify customers...");
    const shopifyCustomers = await prisma.shopifyCustomer.findMany({
      where: {
        OR: [
          { phone: { in: phoneVariations } },
          { defaultAddressPhone: { in: phoneVariations } },
          { note: { contains: phone } }
        ]
      }
    });

    if (shopifyCustomers.length > 0) {
      console.log(`✅ Found ${shopifyCustomers.length} Shopify customer(s):`);
      shopifyCustomers.forEach(c => {
        console.log(`   - ID: ${c.id}`);
        console.log(`     Name: ${c.firstName} ${c.lastName}`);
        console.log(`     Phone: ${c.phone || 'N/A'}`);
        console.log(`     Default Address Phone: ${c.defaultAddressPhone || 'N/A'}`);
        console.log(`     Email: ${c.email || 'N/A'}`);
        if (c.note && c.note.includes(phone)) {
          console.log(`     Note contains phone: YES`);
        }
        console.log();
      });
    } else {
      console.log("   ❌ Not found in Shopify customers\n");
    }

    // Search in customer mappings
    console.log("🔎 Searching in customer mappings...");
    const mappings = await prisma.customerMapping.findMany({
      where: {
        OR: [
          { nhanhCustomerPhone: { in: phoneVariations } },
        ]
      }
    });

    if (mappings.length > 0) {
      console.log(`✅ Found ${mappings.length} mapping(s):`);
      mappings.forEach(m => {
        console.log(`   - Mapping ID: ${m.id}`);
        console.log(`     Nhanh Customer: ${m.nhanhCustomerName} (${m.nhanhCustomerPhone})`);
        console.log(`     Shopify Customer: ${m.shopifyCustomerName} (${m.shopifyCustomerEmail})`);
        console.log(`     Sync Status: ${m.syncStatus}`);
        console.log();
      });
    } else {
      console.log("   ❌ Not found in mappings\n");
    }

    console.log("✨ Search completed!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get phone from command line or use default
const phone = process.argv[2] || "0908663055";
searchPhone(phone);
