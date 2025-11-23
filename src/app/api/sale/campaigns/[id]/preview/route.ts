// API Route: Preview Campaign
import { NextRequest, NextResponse } from "next/server";
import { saleService } from "@/lib/sale-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/sale/campaigns/[id]/preview
 * Preview campaign effects
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const preview = await saleService.previewCampaign(id);

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error: any) {
    console.error("Error previewing campaign:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to preview campaign",
      },
      { status: 500 }
    );
  }
}
