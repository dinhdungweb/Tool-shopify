// API Route: Sale Scheduler Status
import { NextRequest, NextResponse } from "next/server";
import { saleScheduler } from "@/lib/sale-scheduler";

export const dynamic = "force-dynamic";

/**
 * GET /api/sale/scheduler/status
 * Get scheduler status and upcoming campaigns
 */
export async function GET(request: NextRequest) {
  try {
    const status = saleScheduler.getStatus();
    const upcoming = await saleScheduler.getUpcomingCampaigns(5);
    const active = await saleScheduler.getActiveCampaignsWithEndDate(5);

    return NextResponse.json({
      success: true,
      data: {
        scheduler: status,
        upcomingCampaigns: upcoming,
        activeCampaigns: active,
      },
    });
  } catch (error: any) {
    console.error("Error getting scheduler status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get scheduler status",
      },
      { status: 500 }
    );
  }
}
