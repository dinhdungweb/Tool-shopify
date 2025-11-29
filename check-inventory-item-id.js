// Check if shopifyInventoryItemId is cached in database
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkInventoryItemIds() {
  try {
    const mappings = await prisma.productMapping.findMany({
      where: {
        shopifyVariantId: { not: null },
      },
      select: {
        id: true,
        nhanhProductName: true,
        shopifyVariantId: true,
        shopifyInventoryItemId: true,
        syncStatus: true,
      },
      take: 10,
    });

    console.log(`\n📊 Checking ${mappings.length} product mappings:\n`);

    let withCache = 0;
    let withoutCache = 0;

    for (const mapping of mappings) {
      const hasCache = !!mapping.shopifyInventoryItemId;
      if (hasCache) withCache++;
      else withoutCache++;

      console.log(`${hasCache ? '✅' : '❌'} ${mapping.nhanhProductName}`);
      console.log(`   Variant ID: ${mapping.shopifyVariantId}`);
      console.log(`   Inventory Item ID: ${mapping.shopifyInventoryItemId || 'NOT CACHED'}`);
      console.log(`   Status: ${mapping.syncStatus}\n`);
    }

    console.log(`\n📈 Summary:`);
    console.log(`   ✅ With cache: ${withCache}`);
    console.log(`   ❌ Without cache: ${withoutCache}`);
    console.log(`\n💡 First sync needs 2 API calls, after cache only 1 API call!`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInventoryItemIds();
