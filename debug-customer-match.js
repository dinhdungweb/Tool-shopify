// Debug script to check why customer 0385890707 is not matching
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to normalize phone - same logic as auto-match
function normalizePhone(phone) {
  if (!phone) return [];
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
  const variations = new Set([cleaned]);

  if (cleaned.startsWith("0")) {
    variations.add("84" + cleaned.substring(1));
    variations.add(cleaned.substring(1));
  } else if (cleaned.startsWith("84")) {
    variations.add("0" + cleaned.substring(2));
    variations.add(cleaned.substring(2));
  } else if (cleaned.length >= 9 && cleaned.length <= 10) {
    variations.add("0" + cleaned);
    variations.add("84" + cleaned);
  }

  return Array.from(variations);
}

// Helper to extract phones from note
function extractPhonesFromNote(note) {
  if (!note) return [];
  const phoneRegex = /(?:\+?84|0)(?:\d[\s\-\.]?){8,10}\d/g;
  const matches = note.match(phoneRegex);
  if (!matches) return [];

  const phones = [];
  matches.forEach(match => {
    const normalized = match.replace(/[\s\-\(\)\+\.]/g, "");
    phones.push(...normalizePhone(normalized));
  });

  return [...new Set(phones)];
}

async function debugCustomer() {
  try {
    const searchPhone = "0385890707";
    console.log(`\n🔍 Debugging customer with phone: ${searchPhone}`);
    console.log("=".repeat(80));

    // 1. Find Nhanh customer
    console.log("\n📋 Step 1: Finding Nhanh customer...");
    const nhanhCustomer = await prisma.nhanhCustomer.findFirst({
      where: {
        phone: searchPhone
      },
      include: {
        mapping: true
      }
    });

    if (!nhanhCustomer) {
      console.log("❌ Nhanh customer not found!");
      return;
    }

    console.log("✅ Found Nhanh customer:");
    console.log(`   - ID: ${nhanhCustomer.id}`);
    console.log(`   - Name: ${nhanhCustomer.name}`);
    console.log(`   - Phone: ${nhanhCustomer.phone}`);
    console.log(`   - Email: ${nhanhCustomer.email || 'N/A'}`);
    console.log(`   - Has mapping: ${nhanhCustomer.mapping ? 'YES' : 'NO'}`);

    if (nhanhCustomer.mapping) {
      console.log(`   - Mapping status: ${nhanhCustomer.mapping.syncStatus}`);
      console.log(`   - Shopify customer ID: ${nhanhCustomer.mapping.shopifyCustomerId}`);
      console.log("\n⚠️  Customer already has a mapping!");
      return;
    }

    // 2. Generate phone variations
    console.log("\n📞 Step 2: Generating phone variations...");
    const phoneVariations = normalizePhone(nhanhCustomer.phone);
    console.log(`   Generated ${phoneVariations.length} variations:`);
    phoneVariations.forEach(v => console.log(`   - ${v}`));

    // 3. Search Shopify customers by primary phone
    console.log("\n🔍 Step 3: Searching Shopify customers by primary phone...");
    const shopifyByPhone = await prisma.shopifyCustomer.findMany({
      where: {
        phone: {
          in: phoneVariations
        }
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

    console.log(`   Found ${shopifyByPhone.length} customers by primary phone`);
    shopifyByPhone.forEach(c => {
      console.log(`   - ${c.firstName} ${c.lastName} (${c.phone})`);
    });

    // 4. Search by defaultAddressPhone
    console.log("\n🔍 Step 4: Searching by defaultAddressPhone...");
    const shopifyByAddressPhone = await prisma.shopifyCustomer.findMany({
      where: {
        defaultAddressPhone: {
          in: phoneVariations
        }
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

    console.log(`   Found ${shopifyByAddressPhone.length} customers by address phone`);
    shopifyByAddressPhone.forEach(c => {
      console.log(`   - ${c.firstName} ${c.lastName} (address: ${c.defaultAddressPhone})`);
    });

    // 5. Search in notes
    console.log("\n🔍 Step 5: Searching in customer notes...");
    const allShopifyCustomers = await prisma.shopifyCustomer.findMany({
      where: {
        note: {
          not: null,
          not: ""
        }
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

    const matchesInNotes = [];
    for (const customer of allShopifyCustomers) {
      const phonesInNote = extractPhonesFromNote(customer.note);
      const hasMatch = phoneVariations.some(v => phonesInNote.includes(v));
      if (hasMatch) {
        matchesInNotes.push(customer);
      }
    }

    console.log(`   Found ${matchesInNotes.length} customers with phone in notes`);
    matchesInNotes.forEach(c => {
      console.log(`   - ${c.firstName} ${c.lastName}`);
      console.log(`     Note: ${c.note.substring(0, 100)}...`);
    });

    // 6. Combine all matches
    console.log("\n📊 Step 6: Combining all matches...");
    const allMatches = new Map();
    
    [...shopifyByPhone, ...shopifyByAddressPhone, ...matchesInNotes].forEach(c => {
      allMatches.set(c.id, c);
    });

    const uniqueMatches = Array.from(allMatches.values());
    console.log(`   Total unique matches: ${uniqueMatches.length}`);

    // 7. Determine match result
    console.log("\n🎯 Step 7: Match result...");
    if (uniqueMatches.length === 0) {
      console.log("❌ NO MATCH: No Shopify customer found with this phone");
      console.log("\n💡 Possible reasons:");
      console.log("   1. Phone number doesn't exist in Shopify");
      console.log("   2. Phone format is different");
      console.log("   3. Customer hasn't been pulled from Shopify yet");
    } else if (uniqueMatches.length === 1) {
      console.log("✅ PERFECT MATCH: Found exactly 1 Shopify customer");
      const match = uniqueMatches[0];
      console.log(`   - Shopify ID: ${match.id}`);
      console.log(`   - Name: ${match.firstName} ${match.lastName}`);
      console.log(`   - Phone: ${match.phone || 'N/A'}`);
      console.log(`   - Address Phone: ${match.defaultAddressPhone || 'N/A'}`);
      console.log(`   - Email: ${match.email || 'N/A'}`);
      console.log("\n✨ This customer SHOULD be auto-matched!");
    } else {
      console.log(`⚠️  MULTIPLE MATCHES: Found ${uniqueMatches.length} Shopify customers`);
      console.log("   Auto-match skipped to avoid incorrect mapping");
      console.log("\n   Matched customers:");
      uniqueMatches.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.firstName} ${c.lastName} (${c.phone || c.defaultAddressPhone})`);
      });
      console.log("\n💡 Manual mapping required to choose the correct customer");
    }

    console.log("\n" + "=".repeat(80));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCustomer();
