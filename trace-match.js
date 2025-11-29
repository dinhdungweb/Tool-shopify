/**
 * Trace how a specific customer was matched
 * Usage: node trace-match.js <nhanhCustomerId>
 * Example: node trace-match.js 1423813490
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Phone normalization (same as auto-match logic)
function normalizePhone(phone) {
  if (!phone) return [];
  
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  const variants = new Set();
  
  // Original cleaned
  variants.add(cleaned);
  
  // Remove country code variants
  if (cleaned.startsWith("84")) {
    variants.add("0" + cleaned.substring(2));
  }
  if (cleaned.startsWith("+84")) {
    variants.add("0" + cleaned.substring(3));
  }
  if (cleaned.startsWith("0")) {
    variants.add("84" + cleaned.substring(1));
  }
  
  return Array.from(variants);
}

// Extract phones from note
function extractPhonesFromNote(note) {
  if (!note) return [];
  
  const phoneRegex = /(?:\+?84|0)[\s\-\.]?[1-9](?:[\s\-\.]?\d){8}/g;
  const matches = note.match(phoneRegex) || [];
  
  const allVariants = new Set();
  matches.forEach(match => {
    normalizePhone(match).forEach(v => allVariants.add(v));
  });
  
  return Array.from(allVariants);
}

async function traceMatch(nhanhCustomerId) {
  try {
    console.log(`\n🔍 Tracing match for Nhanh customer: ${nhanhCustomerId}\n`);

    // Get Nhanh customer
    const nhanhCustomer = await prisma.nhanhCustomer.findUnique({
      where: { id: nhanhCustomerId },
      include: {
        mapping: true,
      },
    });

    if (!nhanhCustomer) {
      console.log("❌ Nhanh customer not found");
      return;
    }

    console.log("📋 Nhanh Customer:");
    console.log(`   ID: ${nhanhCustomer.id}`);
    console.log(`   Name: ${nhanhCustomer.name}`);
    console.log(`   Phone: ${nhanhCustomer.phone}`);
    console.log(`   Email: ${nhanhCustomer.email || "N/A"}`);
    console.log(`   Total Spent: ${nhanhCustomer.totalSpent?.toLocaleString() || 0} VND`);

    if (!nhanhCustomer.mapping) {
      console.log("\n❌ No mapping found for this customer");
      return;
    }

    console.log("\n✅ Mapping exists!");
    console.log(`   Mapping ID: ${nhanhCustomer.mapping.id}`);
    console.log(`   Status: ${nhanhCustomer.mapping.syncStatus}`);
    console.log(`   Created: ${nhanhCustomer.mapping.createdAt}`);
    console.log(`   Shopify Customer ID: ${nhanhCustomer.mapping.shopifyCustomerId || "N/A"}`);
    console.log(`   Shopify Customer Name: ${nhanhCustomer.mapping.shopifyCustomerName || "N/A"}`);
    console.log(`   Shopify Customer Email: ${nhanhCustomer.mapping.shopifyCustomerEmail || "N/A"}`);

    // Get full Shopify customer details
    if (!nhanhCustomer.mapping.shopifyCustomerId) {
      console.log("\n⚠️  No Shopify customer ID in mapping");
      return;
    }

    const shopifyCustomer = await prisma.shopifyCustomer.findUnique({
      where: { id: nhanhCustomer.mapping.shopifyCustomerId },
    });

    if (!shopifyCustomer) {
      console.log("\n❌ Shopify customer not found in database");
      return;
    }

    console.log("\n📋 Shopify Customer (Full Details):");
    console.log(`   ID: ${shopifyCustomer.id}`);
    console.log(`   Name: ${shopifyCustomer.firstName} ${shopifyCustomer.lastName}`);
    console.log(`   Email: ${shopifyCustomer.email || "N/A"}`);
    console.log(`   Phone: ${shopifyCustomer.phone || "N/A"}`);
    console.log(`   Default Address Phone: ${shopifyCustomer.defaultAddressPhone || "N/A"}`);
    console.log(`   Note: ${shopifyCustomer.note ? `${shopifyCustomer.note.substring(0, 100)}...` : "N/A"}`);

    // Analyze phone matching
    console.log("\n🔍 Phone Matching Analysis:");
    
    if (!nhanhCustomer.phone) {
      console.log("   ⚠️  Nhanh customer has no phone");
      return;
    }

    const nhanhPhones = normalizePhone(nhanhCustomer.phone);
    console.log(`   Nhanh phone variants: ${nhanhPhones.join(", ")}`);

    // Check primary phone
    if (shopifyCustomer.phone) {
      const shopifyPhones = normalizePhone(shopifyCustomer.phone);
      console.log(`\n   📞 Shopify primary phone: ${shopifyCustomer.phone}`);
      console.log(`      Variants: ${shopifyPhones.join(", ")}`);
      
      const match = nhanhPhones.some(np => shopifyPhones.includes(np));
      if (match) {
        console.log(`      ✅ MATCH FOUND via primary phone!`);
      }
    }

    // Check default address phone
    if (shopifyCustomer.defaultAddressPhone) {
      const addressPhones = normalizePhone(shopifyCustomer.defaultAddressPhone);
      console.log(`\n   📍 Shopify address phone: ${shopifyCustomer.defaultAddressPhone}`);
      console.log(`      Variants: ${addressPhones.join(", ")}`);
      
      const match = nhanhPhones.some(np => addressPhones.includes(np));
      if (match) {
        console.log(`      ✅ MATCH FOUND via address phone!`);
      }
    }

    // Check note
    if (shopifyCustomer.note) {
      const notePhones = extractPhonesFromNote(shopifyCustomer.note);
      if (notePhones.length > 0) {
        console.log(`\n   📝 Phones in note: ${notePhones.join(", ")}`);
        
        const match = nhanhPhones.some(np => notePhones.includes(np));
        if (match) {
          console.log(`      ✅ MATCH FOUND via note!`);
          console.log(`      Note content: ${shopifyCustomer.note}`);
        }
      }
    }

    console.log("\n✅ Trace completed!");

  } catch (error) {
    console.error("❌ Error tracing match:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get customer ID from command line
const customerId = process.argv[2];

if (!customerId) {
  console.log("Usage: node trace-match.js <nhanhCustomerId>");
  console.log("Example: node trace-match.js 1423813490");
  process.exit(1);
}

traceMatch(customerId);
