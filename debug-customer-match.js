/**
 * Script debug kiểm tra customer matching
 * Usage: node debug-customer-match.js 0794936853
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function debugMatch(phone) {
    console.log(`\n🔍 Debugging customer match for phone: ${phone}\n`);
    console.log("=".repeat(60));

    // Normalize phone số
    const normalizedPhone = phone.replace(/^0/, "").replace(/\D/g, "");
    console.log(`📱 Normalized phone: ${normalizedPhone}`);

    // Tìm trong Nhanh
    console.log("\n--- NHANH CUSTOMERS ---");
    const nhanhCustomers = await prisma.nhanhCustomer.findMany({
        where: {
            OR: [
                { phone: { contains: phone } },
                { phone: { contains: normalizedPhone } },
            ]
        },
        take: 5,
    });

    if (nhanhCustomers.length === 0) {
        console.log("❌ Không tìm thấy customer trong Nhanh");
    } else {
        nhanhCustomers.forEach(c => {
            console.log(`✅ Found: ${c.name} | Phone: ${c.phone} | ID: ${c.id}`);
        });
    }

    // Tìm trong Shopify
    console.log("\n--- SHOPIFY CUSTOMERS ---");
    const shopifyCustomers = await prisma.shopifyCustomer.findMany({
        where: {
            OR: [
                { phone: { contains: phone } },
                { phone: { contains: normalizedPhone } },
                { defaultAddressPhone: { contains: phone } },
                { defaultAddressPhone: { contains: normalizedPhone } },
                { phone: { contains: `+84${normalizedPhone}` } },
                { defaultAddressPhone: { contains: `+84${normalizedPhone}` } },
            ]
        },
        take: 5,
    });

    if (shopifyCustomers.length === 0) {
        console.log("❌ Không tìm thấy customer trong Shopify");
        console.log("\n🔎 Thử tìm với các format khác...");

        // Tìm với like pattern
        const patterns = [
            `%${normalizedPhone}%`,
            `%${phone}%`,
            `%+84${normalizedPhone}%`,
            `%84${normalizedPhone}%`,
        ];

        for (const pattern of patterns) {
            const result = await prisma.$queryRawUnsafe(`
        SELECT id, phone, "defaultAddressPhone", email, "firstName", "lastName"
        FROM shopify_customers
        WHERE phone LIKE $1 OR "defaultAddressPhone" LIKE $1
        LIMIT 3
      `, pattern);

            if (result.length > 0) {
                console.log(`   Pattern "${pattern}" found ${result.length} results:`);
                result.forEach(r => {
                    console.log(`   - ${r.firstName} ${r.lastName} | Phone: ${r.phone} | Addr: ${r.defaultAddressPhone}`);
                });
            }
        }
    } else {
        shopifyCustomers.forEach(c => {
            console.log(`✅ Found: ${c.firstName} ${c.lastName} | Phone: ${c.phone} | AddrPhone: ${c.defaultAddressPhone} | ID: ${c.id}`);
        });
    }

    // Kiểm tra mapping hiện tại
    console.log("\n--- CUSTOMER MAPPING ---");
    if (nhanhCustomers.length > 0) {
        const mapping = await prisma.customerMapping.findUnique({
            where: { nhanhCustomerId: nhanhCustomers[0].id }
        });

        if (mapping) {
            console.log(`✅ Đã có mapping: Nhanh ${mapping.nhanhCustomerId} -> Shopify ${mapping.shopifyCustomerId}`);
        } else {
            console.log("❌ Chưa có mapping");
        }
    }

    console.log("\n" + "=".repeat(60));
    await prisma.$disconnect();
}

const phone = process.argv[2] || "0794936853";
debugMatch(phone);
