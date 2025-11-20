import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync/mapping/[id]
 * Get a specific mapping
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mapping = await prisma.customerMapping.findUnique({
      where: { id },
      include: {
        syncLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!mapping) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mapping,
    });
  } catch (error: any) {
    console.error("Error fetching mapping:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch mapping",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sync/mapping/[id]
 * Update a mapping
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      shopifyCustomerId,
      shopifyCustomerEmail,
      shopifyCustomerName,
      syncStatus,
    } = body;

    const mapping = await prisma.customerMapping.update({
      where: { id },
      data: {
        shopifyCustomerId,
        shopifyCustomerEmail,
        shopifyCustomerName,
        syncStatus: syncStatus || (shopifyCustomerId ? SyncStatus.PENDING : SyncStatus.UNMAPPED),
      },
    });

    // Create sync log
    await prisma.syncLog.create({
      data: {
        mappingId: mapping.id,
        action: "MANUAL_MAPPING",
        status: mapping.syncStatus,
        message: "Mapping updated",
      },
    });

    return NextResponse.json({
      success: true,
      data: mapping,
    });
  } catch (error: any) {
    console.error("Error updating mapping:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update mapping",
      },
      { status: 500 }
    );
  }
}
