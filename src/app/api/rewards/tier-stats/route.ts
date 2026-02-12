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
 * Tính lại hạng cho khách hàng đã mapping
 */
export async function POST(request: NextRequest) {
    try {
        console.log("🔄 Đang tính lại hạng cho khách hàng đã mapping...");

        const batchSize = 500;

        // Chỉ cập nhật tier cho CustomerMapping (khách đã mapping)
        const mappings = await prisma.customerMapping.findMany({
            select: { id: true, nhanhTotalSpent: true },
        });

        let updated = 0;

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

            updated += batch.length;
            console.log(`  ✅ Đã cập nhật ${updated}/${mappings.length} khách hàng`);
        }

        console.log(`🎉 Hoàn thành! Đã tính lại hạng cho ${mappings.length} khách hàng đã mapping.`);

        return NextResponse.json({
            success: true,
            data: {
                mappingsUpdated: mappings.length,
                message: `Đã tính lại hạng cho ${mappings.length} khách hàng đã mapping.`,
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
