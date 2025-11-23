// API Route: Check Campaign Conflicts
import { NextRequest, NextResponse } from "next/server";
import { saleService } from "@/lib/sale-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/sale/campaigns/check-conflicts
 * Check if campaign conflicts with existing active campaigns
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetType, targetIds, productType, excludeCampaignId } = body;

    if (!targetType) {
      return NextResponse.json(
        {
          success: false,
          error: "Target type is required",
        },
        { status: 400 }
      );
    }

    const result = await saleService.checkConflicts(
      targetType,
      targetIds || [],
      productType,
      excludeCampaignId
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error checking conflicts:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to check conflicts",
      },
      { status: 500 }
    );
  }
}
