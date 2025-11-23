// API Route: Apply Campaign
import { NextRequest, NextResponse } from "next/server";
import { saleService } from "@/lib/sale-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/sale/campaigns/[id]/apply
 * Apply campaign to Shopify
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Applying campaign ${id}...`);

    const result = await saleService.applyCampaign(id);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to apply campaign",
          data: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Campaign applied successfully. ${result.affectedCount} variants updated.`,
      data: result,
    });
  } catch (error: any) {
    console.error("Error applying campaign:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to apply campaign",
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
