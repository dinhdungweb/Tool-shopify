// API Route: Manually Trigger Scheduler Check
import { NextRequest, NextResponse } from "next/server";
import { saleScheduler } from "@/lib/sale-scheduler";

export const dynamic = "force-dynamic";

/**
 * POST /api/sale/scheduler/trigger
 * Manually trigger scheduler check (for testing)
 */
export async function POST(request: NextRequest) {
  try {
    console.log("Manually triggering scheduler check...");
    await saleScheduler.triggerCheck();

    return NextResponse.json({
      success: true,
      message: "Scheduler check triggered successfully",
    });
  } catch (error: any) {
    console.error("Error triggering scheduler:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to trigger scheduler",
      },
      { status: 500 }
    );
  }
}
