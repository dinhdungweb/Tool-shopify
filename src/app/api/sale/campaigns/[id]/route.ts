// API Route: Single Campaign Operations
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/sale/campaigns/[id]
 * Get campaign details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaign = await prisma.saleCampaign.findUnique({
      where: { id },
      include: {
        priceChanges: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        _count: {
          select: { priceChanges: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        {
          success: false,
          error: "Campaign not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error: any) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch campaign",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sale/campaigns/[id]
 * Update campaign
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if campaign exists and is editable
    const existingCampaign = await prisma.saleCampaign.findUnique({
      where: { id },
    });

    if (!existingCampaign) {
      return NextResponse.json(
        {
          success: false,
          error: "Campaign not found",
        },
        { status: 404 }
      );
    }

    if (existingCampaign.status === "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot edit active campaign",
        },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      discountType,
      discountValue,
      targetType,
      targetIds,
      productType,
      scheduleType,
      startDate,
      endDate,
      status,
    } = body;

    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (discountType !== undefined) updateData.discountType = discountType;
    if (discountValue !== undefined) updateData.discountValue = discountValue;
    if (targetType !== undefined) updateData.targetType = targetType;
    if (targetIds !== undefined) updateData.targetIds = targetIds;
    if (productType !== undefined) updateData.productType = productType;
    if (scheduleType !== undefined) updateData.scheduleType = scheduleType;
    if (startDate !== undefined)
      updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined)
      updateData.endDate = endDate ? new Date(endDate) : null;
    if (status !== undefined) updateData.status = status;

    const campaign = await prisma.saleCampaign.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error: any) {
    console.error("Error updating campaign:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update campaign",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sale/campaigns/[id]
 * Delete campaign
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaign = await prisma.saleCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return NextResponse.json(
        {
          success: false,
          error: "Campaign not found",
        },
        { status: 404 }
      );
    }

    // Prevent deletion of campaigns that are in progress or active
    if (campaign.status === "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete active campaign. Please revert it first.",
        },
        { status: 400 }
      );
    }

    if (campaign.status === "APPLYING") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete campaign while it's being applied. Please wait for it to complete.",
        },
        { status: 400 }
      );
    }

    if (campaign.status === "REVERTING") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete campaign while it's being reverted. Please wait for it to complete.",
        },
        { status: 400 }
      );
    }

    await prisma.saleCampaign.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Campaign deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting campaign:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete campaign",
      },
      { status: 500 }
    );
  }
}
