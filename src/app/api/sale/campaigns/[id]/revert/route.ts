// API Route: Revert Campaign
import { NextRequest, NextResponse } from "next/server";
import { saleService } from "@/lib/sale-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/sale/campaigns/[id]/revert
 * Revert campaign prices
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Reverting campaign ${id}...`);

    const result = await saleService.revertCampaign(id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to revert campaign",
          data: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Campaign reverted successfully. ${result.revertedCount} variants restored.`,
      data: result,
    });
  } catch (error: any) {
    console.error("Error reverting campaign:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to revert campaign",
      },
      { status: 500 }
    );
  }
}
