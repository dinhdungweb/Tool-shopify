// API Route: Recover stuck campaigns
import { NextRequest, NextResponse } from "next/server";
import { saleService } from "@/lib/sale-service";
import { getStoreContextOrDefault } from "@/lib/store-context";

export const dynamic = "force-dynamic";

/**
 * POST /api/sale/campaigns/recover
 * Recover campaigns stuck in APPLYING or REVERTING status
 */
export async function POST(request: NextRequest) {
  try {
    const { storeId } = await getStoreContextOrDefault(request);
    const recovered = await saleService.recoverStuckCampaigns(storeId);
    if (recovered.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No stuck campaigns found",
        recovered: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Recovered ${recovered.length} stuck campaigns`,
      recovered,
    });
  } catch (error: any) {
    console.error("Error recovering campaigns:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to recover campaigns",
      },
      { status: 500 }
    );
  }
}
