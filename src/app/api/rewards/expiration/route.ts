import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";
import { getTierLabel } from "@/lib/tier-constants";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/rewards/expiration
 * Kiểm tra và thực thi các lịch hết hạn điểm
 * Nên được gọi bởi cron job
 */
export async function POST(request: NextRequest) {
    try {
        const { rewardService } = await import("@/lib/reward-service");
        const result = await rewardService.checkExpirations();

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error processing expirations:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Lỗi khi xử lý hết hạn điểm" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/rewards/expiration
 * Lấy danh sách lịch hết hạn
 */
export async function GET(request: NextRequest) {
    try {
        const schedules = await prisma.pointExpirationSchedule.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return NextResponse.json({
            success: true,
            data: schedules,
        });
    } catch (error: any) {
        console.error("Error fetching schedules:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/rewards/expiration
 * Hủy lịch hết hạn (chỉ PENDING)
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { success: false, error: "Thiếu ID lịch hết hạn" },
                { status: 400 }
            );
        }

        const schedule = await prisma.pointExpirationSchedule.findUnique({
            where: { id },
        });

        if (!schedule) {
            return NextResponse.json(
                { success: false, error: "Không tìm thấy lịch hết hạn" },
                { status: 404 }
            );
        }

        if (schedule.status !== "PENDING") {
            return NextResponse.json(
                { success: false, error: "Chỉ có thể hủy lịch đang chờ (PENDING)" },
                { status: 400 }
            );
        }

        await prisma.pointExpirationSchedule.update({
            where: { id },
            data: { status: "CANCELLED" },
        });

        return NextResponse.json({
            success: true,
            data: { message: "Đã hủy lịch hết hạn." },
        });
    } catch (error: any) {
        console.error("Error cancelling schedule:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
