import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TIER_THRESHOLDS, calculateTier } from "@/lib/tier-constants";

export const dynamic = "force-dynamic";

/**
 * GET /api/rewards/tier-stats
 * Lấy thống kê số lượng khách hàng theo từng hạng
 */
export async function GET(request: NextRequest) {
    try {
        // Lấy tổng số CustomerMapping theo tier (tất cả đã mapping)
        const tierCounts = await prisma.customerMapping.groupBy({
            by: ["tier"],
            _count: { id: true },
        });

        // Lấy tổng số CustomerMapping đã sync Shopify theo tier
        const syncedTierCounts = await prisma.customerMapping.groupBy({
            by: ["tier"],
            where: {
                syncStatus: "SYNCED",
                shopifyCustomerId: { not: null },
            },
            _count: { id: true },
        });

        // Build stats
        const stats = TIER_THRESHOLDS.map((t) => {
            const mappedCount = tierCounts.find((c: any) => c.tier === t.tier)?._count.id || 0;
            const syncedCount = syncedTierCounts.find((c: any) => c.tier === t.tier)?._count.id || 0;

            return {
                tier: t.tier,
                label: t.label,
                color: t.color,
                min: t.min,
                totalCustomers: mappedCount,   // Tổng KH đã mapping
                syncedCustomers: syncedCount,  // KH đã sync Shopify
            };
        });

        // Tổng
        const totalCustomers = stats.reduce((sum, s) => sum + s.totalCustomers, 0);
        const totalSynced = stats.reduce((sum, s) => sum + s.syncedCustomers, 0);

        return NextResponse.json({
            success: true,
            data: {
                stats,
                total: {
                    customers: totalCustomers,
                    synced: totalSynced,
                },
            },
        });
    } catch (error: any) {
        console.error("Error fetching tier stats:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/rewards/tier-stats
 * Tính lại hạng cho tất cả khách hàng (migration)
 */
export async function POST(request: NextRequest) {
    try {
        console.log("🔄 Đang tính lại hạng cho tất cả khách hàng...");

        // Lấy tất cả NhanhCustomer
        const customers = await prisma.nhanhCustomer.findMany({
            select: { id: true, totalSpent: true },
        });

        let updated = 0;
        const batchSize = 500;

        for (let i = 0; i < customers.length; i += batchSize) {
            const batch = customers.slice(i, i + batchSize);

            await prisma.$transaction(
                batch.map((c) =>
                    prisma.nhanhCustomer.update({
                        where: { id: c.id },
                        data: { tier: calculateTier(Number(c.totalSpent)) },
                    })
                )
            );

            updated += batch.length;
            console.log(`  ✅ Đã cập nhật ${updated}/${customers.length} khách hàng`);
        }

        // Cập nhật tier cho CustomerMapping
        const mappings = await prisma.customerMapping.findMany({
            select: { id: true, nhanhTotalSpent: true },
        });

        for (let i = 0; i < mappings.length; i += batchSize) {
            const batch = mappings.slice(i, i + batchSize);

            await prisma.$transaction(
                batch.map((m) =>
                    prisma.customerMapping.update({
                        where: { id: m.id },
                        data: { tier: calculateTier(Number(m.nhanhTotalSpent)) },
                    })
                )
            );
        }

        console.log(`🎉 Hoàn thành! Đã tính lại hạng cho ${customers.length} khách hàng và ${mappings.length} mapping.`);

        return NextResponse.json({
            success: true,
            data: {
                customersUpdated: customers.length,
                mappingsUpdated: mappings.length,
                message: `Đã tính lại hạng cho ${customers.length} khách hàng.`,
            },
        });
    } catch (error: any) {
        console.error("Error recalculating tiers:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
