const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper to normalize phone
function normalizePhone(phone) {
  if (!phone) return [];
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
  const variations = [cleaned];
  
  if (cleaned.startsWith("0")) {
    variations.push("84" + cleaned.substring(1));
  } else if (cleaned.startsWith("84")) {
    variations.push("0" + cleaned.substring(2));
  }
  
  return variations;
}

async function debugMatch(phone) {
  try {
    console.log(`🔍 Debugging match for phone: ${phone}\n`);

    const phoneVariations = normalizePhone(phone);
    console.log(`📱 Phone variations: ${phoneVariations.join(", ")}\n`);

    // 1. Check Nhanh customers
    console.log("1️⃣ Checking Nhanh customers...");
    const nhanhCustomers = await prisma.nhanhCustomer.findMany({
      where: {
        phone: { in: phoneVariations }
      },
      include: {
        mapping: true
      }
    });

    if (nhanhCustomers.length > 0) {
      console.log(`   ✅ Found ${nhanhCustomers.length} Nhanh customer(s):`);
      nhanhCustomers.forEach(c => {
        console.log(`      - ${c.name} (ID: ${c.id})`);
        console.log(`        Phone: ${c.phone}`);
        console.log(`        Mapped: ${c.mapping ? 'YES ✓' : 'NO ✗'}`);
        if (c.mapping) {
          console.log(`        → Shopify ID: ${c.mapping.shopifyCustomerId}`);
        }
      });
    } else {
      console.log(`   ❌ No Nhanh customers found`);
    }
    console.log();

    // 2. Check Shopify customers
    console.log("2️⃣ Checking Shopify customers...");
    const shopifyCustomers = await prisma.shopifyCustomer.findMany({
      where: {
        OR: [
          { phone: { in: phoneVariations } },
          { defaultAddressPhone: { in: phoneVariations } },
        ]
      }
    });

    if (shopifyCustomers.length > 0) {
      console.log(`   ✅ Found ${shopifyCustomers.length} Shopify customer(s):`);
      shopifyCustomers.forEach(c => {
        console.log(`      - ${c.firstName} ${c.lastName} (ID: ${c.id})`);
        console.log(`        Phone: ${c.phone || 'N/A'}`);
        console.log(`        Default Address Phone: ${c.defaultAddressPhone || 'N/A'}`);
        console.log(`        Email: ${c.email || 'N/A'}`);
      });
    } else {
      console.log(`   ❌ No Shopify customers found`);
    }
    console.log();

    // 3. Check if mapping exists
    console.log("3️⃣ Checking existing mappings...");
    const mappings = await prisma.customerMapping.findMany({
      where: {
        OR: [
          { nhanhCustomerPhone: { in: phoneVariations } },
        ]
      }
    });

    if (mappings.length > 0) {
      console.log(`   ✅ Found ${mappings.length} existing mapping(s):`);
      mappings.forEach(m => {
        console.log(`      - ${m.nhanhCustomerName} → ${m.shopifyCustomerName}`);
        console.log(`        Status: ${m.syncStatus}`);
      });
    } else {
      console.log(`   ❌ No mappings found`);
    }
    console.log();

    // 4. Analyze why not matched
    console.log("4️⃣ Analysis:");
    if (nhanhCustomers.length === 0) {
      console.log(`   ⚠️  No Nhanh customer with this phone`);
    } else if (shopifyCustomers.length === 0) {
      console.log(`   ⚠️  No Shopify customer with this phone`);
    } else if (nhanhCustomers.length > 1) {
      console.log(`   ⚠️  Multiple Nhanh customers (${nhanhCustomers.length}) - auto-match skips duplicates`);
    } else if (shopifyCustomers.length > 1) {
      console.log(`   ⚠️  Multiple Shopify customers (${shopifyCustomers.length}) - auto-match skips duplicates`);
    } else if (nhanhCustomers[0].mapping) {
      console.log(`   ℹ️  Already mapped!`);
    } else {
      console.log(`   ✅ Should be matched! (1 Nhanh + 1 Shopify)`);
      console.log(`   💡 Try running auto-match again`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get phone from command line
const phone = process.argv[2] || "0358259084";
debugMatch(phone);
