import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";
import { CustomerTier, getTierLabel } from "@/lib/tier-constants";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/rewards/add-points
 * Cộng điểm thưởng cho khách hàng theo hạng
 * Body: { tier: string, points: number, expirationDate?: string }
 */
export async function POST(request: NextRequest) {
    let job: any = null;

    try {
        const body = await request.json();
        const { tier, tiers, points, expirationDate } = body;

        if ((!tier && !tiers?.length) || !points || points <= 0) {
            return NextResponse.json(
                { success: false, error: "Vui lòng chọn ít nhất một hạng và nhập số điểm hợp lệ." },
                { status: 400 }
            );
        }

        const targetTiers = tiers || [tier];
        const targetTierLabels = targetTiers.map((t: string) => getTierLabel(t)).join(", ");

        // Tìm tất cả CustomerMapping thuộc các hạng này và đã liên kết Shopify
        const mappings = await prisma.customerMapping.findMany({
            where: {
                tier: { in: targetTiers },
                shopifyCustomerId: { not: null },
                syncStatus: "SYNCED",
            },
            select: {
                id: true,
                shopifyCustomerId: true,
                nhanhCustomerName: true,
                tier: true,
            },
        });

        if (mappings.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    tier: targetTiers.join(","),
                    tierLabel: targetTierLabels,
                    totalCustomers: 0,
                    message: `Không tìm thấy khách hàng nào thuộc hạng ${targetTierLabels} đã được đồng bộ.`,
                },
            });
        }

        // Tạo background job
        job = await prisma.backgroundJob.create({
            data: {
                type: "ADD_REWARD_POINTS",
                total: mappings.length,
                status: "RUNNING",
                metadata: {
                    tiers: targetTiers,
                    tierLabel: targetTierLabels,
                    points,
                    expirationDate: expirationDate || null,
                },
            },
        });

        // Lưu lịch hết hạn nếu có (tạo bản ghi riêng cho từng hạng)
        const scheduleIds: string[] = [];
        if (expirationDate) {
            for (const t of targetTiers) {
                // Đếm số lượng khách hàng thuộc hạng này để lưu vào affectedCount
                const countForTier = mappings.filter((m: any) => m.tier === t).length;

                if (countForTier > 0) {
                    const schedule = await prisma.pointExpirationSchedule.create({
                        data: {
                            tier: t,
                            pointsAdded: points,
                            expiresAt: new Date(expirationDate),
                            status: "PENDING",
                            affectedCount: countForTier,
                            description: `Cộng ${points} điểm cho hạng ${getTierLabel(t)} - Hết hạn: ${expirationDate}`,
                        },
                    });
                    scheduleIds.push(schedule.id);
                }
            }
        }

        // Bắt đầu xử lý background (không await)
        addPointsInBackground(mappings, points, job.id);

        return NextResponse.json({
            success: true,
            data: {
                tiers: targetTiers,
                tierLabel: targetTierLabels,
                points,
                totalCustomers: mappings.length,
                jobId: job.id,
                scheduleIds,
                expirationDate: expirationDate || null,
                message: `Đang cộng ${points} điểm cho ${mappings.length} khách hàng thuộc ${targetTiers.length} hạng (${targetTierLabels}). Theo dõi tại Job Tracking.`,
            },
        });
    } catch (error: any) {
        console.error("Error adding points:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Lỗi khi cộng điểm" },
            { status: 500 }
        );
    }
}

/**
 * Xử lý cộng điểm nền - Chế độ An toàn nhất (Tuần tự)
 */
async function addPointsInBackground(
    mappings: { id: string; shopifyCustomerId: string | null; nhanhCustomerName: string; tier: string }[],
    points: number,
    jobId: string
) {
    console.log(`🎁 Bắt đầu cộng ${points} điểm cho ${mappings.length} khách hàng (Chế độ An toàn nhất)...`);
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < mappings.length; i++) {
        const mapping = mappings[i];
        try {
            if (!mapping.shopifyCustomerId) {
                console.log(`  ⏩ [${i + 1}/${mappings.length}] Bỏ qua ${mapping.nhanhCustomerName} (Không có Shopify ID)`);
                continue;
            }

            // Cộng điểm vào Shopify metafield rewards.points
            await shopifyAPI.updateCustomerMetafield(mapping.shopifyCustomerId, {
                namespace: "rewards",
                key: "points",
                value: points.toString(),
                type: "number_integer",
            });

            successful++;
            console.log(`  ✅ [${i + 1}/${mappings.length}] ${mapping.nhanhCustomerName}: +${points} điểm`);
        } catch (error: any) {
            failed++;
            console.error(`  ❌ [${i + 1}/${mappings.length}] ${mapping.nhanhCustomerName}: ${error.message}`);
        }

        // Cập nhật tiến trình mỗi 20 khách
        if ((i + 1) % 20 === 0 || i === mappings.length - 1) {
            await prisma.backgroundJob.update({
                where: { id: jobId },
                data: {
                    processed: i + 1,
                    successful,
                    failed,
                    status: "RUNNING",
                    metadata: {
                        points,
                        successful,
                        failed,
                        progress: `${i + 1}/${mappings.length}`,
                    },
                },
            }).catch(() => { });
        }

        // Delay 200ms cho an toàn (Cân bằng tốc độ và Rate Limit)
        if (i < mappings.length - 1) {
            await new Promise((r) => setTimeout(r, 200));
        }
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const duration = durationSeconds < 60 ? `${durationSeconds}s` : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;

    console.log(`🎉 Hoàn thành cộng điểm! Thành công: ${successful}, Thất bại: ${failed}, Thời gian: ${duration}`);

    // Cập nhật job
    await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
            status: failed >= mappings.length && mappings.length > 0 ? "FAILED" : "COMPLETED",
            processed: mappings.length,
            successful,
            failed,
            completedAt: new Date(),
            metadata: {
                points,
                successful,
                failed,
                duration,
            },
        },
    }).catch(() => { });
}
