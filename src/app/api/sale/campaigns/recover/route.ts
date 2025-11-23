// API Route: Recover stuck campaigns
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/sale/campaigns/recover
 * Recover campaigns stuck in APPLYING or REVERTING status
 */
export async function POST() {
  try {
    // Find campaigns stuck in processing states
    const stuckCampaigns = await prisma.saleCampaign.findMany({
      where: {
        OR: [
          { status: "APPLYING" },
          { status: "REVERTING" },
        ],
      },
    });

    if (stuckCampaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No stuck campaigns found",
        recovered: 0,
      });
    }

    const recovered = [];

    for (const campaign of stuckCampaigns) {
      // Check if campaign has any applied price changes
      const appliedChanges = await prisma.priceChange.count({
        where: {
          campaignId: campaign.id,
          applied: true,
          reverted: false,
        },
      });

      let newStatus: string;
      
      if (campaign.status === "APPLYING") {
        // If some changes were applied, mark as ACTIVE
        // Otherwise, mark as FAILED
        newStatus = appliedChanges > 0 ? "ACTIVE" : "FAILED";
      } else {
        // REVERTING
        // If all changes were reverted, mark as COMPLETED
        // Otherwise, mark as ACTIVE (partially reverted)
        const totalChanges = await prisma.priceChange.count({
          where: {
            campaignId: campaign.id,
            applied: true,
          },
        });
        
        newStatus = appliedChanges === 0 ? "COMPLETED" : "ACTIVE";
      }

      await prisma.saleCampaign.update({
        where: { id: campaign.id },
        data: { 
          status: newStatus as any,
          errorMessage: `Recovered from ${campaign.status} state after server restart`,
        },
      });

      recovered.push({
        id: campaign.id,
        name: campaign.name,
        oldStatus: campaign.status,
        newStatus,
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
