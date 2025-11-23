// API Route: Restart Scheduler
import { NextRequest, NextResponse } from "next/server";
import { saleScheduler } from "@/lib/sale-scheduler";

export const dynamic = "force-dynamic";

/**
 * POST /api/sale/scheduler/restart
 * Restart the scheduler
 */
export async function POST(request: NextRequest) {
  try {
    console.log("Restarting sale campaign scheduler...");

    // Stop current scheduler
    saleScheduler.stop();

    // Reinitialize
    await saleScheduler.initialize();

    const status = saleScheduler.getStatus();

    return NextResponse.json({
      success: true,
      message: "Scheduler restarted successfully",
      data: status,
    });
  } catch (error: any) {
    console.error("Error restarting scheduler:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to restart scheduler",
      },
      { status: 500 }
    );
  }
}
