import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync/mapping
 * Get all customer mappings
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status") as SyncStatus | null;

    const skip = (page - 1) * limit;

    const where = status ? { syncStatus: status } : {};

    const [mappings, total] = await Promise.all([
      prisma.customerMapping.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customerMapping.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        mappings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching mappings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch mappings",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/mapping
 * Create a new customer mapping
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      nhanhCustomerId,
      nhanhCustomerName,
      nhanhCustomerPhone,
      nhanhCustomerEmail,
      nhanhTotalSpent,
      shopifyCustomerId,
      shopifyCustomerEmail,
      shopifyCustomerName,
    } = body;

    if (!nhanhCustomerId || !nhanhCustomerName) {
      return NextResponse.json(
        {
          success: false,
          error: "nhanhCustomerId and nhanhCustomerName are required",
        },
        { status: 400 }
      );
    }

    // Check if mapping already exists
    const existing = await prisma.customerMapping.findUnique({
      where: { nhanhCustomerId },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping already exists for this Nhanh customer",
        },
        { status: 409 }
      );
    }

    const mapping = await prisma.customerMapping.create({
      data: {
        nhanhCustomerId,
        nhanhCustomerName,
        nhanhCustomerPhone,
        nhanhCustomerEmail,
        nhanhTotalSpent: nhanhTotalSpent || 0,
        shopifyCustomerId,
        shopifyCustomerEmail,
        shopifyCustomerName,
        syncStatus: shopifyCustomerId ? SyncStatus.PENDING : SyncStatus.UNMAPPED,
      },
    });

    // Create sync log
    await prisma.syncLog.create({
      data: {
        mappingId: mapping.id,
        action: "MANUAL_MAPPING",
        status: mapping.syncStatus,
        message: "Mapping created",
      },
    });

    return NextResponse.json({
      success: true,
      data: mapping,
    });
  } catch (error: any) {
    console.error("Error creating mapping:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create mapping",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sync/mapping?id=xxx
 * Delete a customer mapping
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping ID is required",
        },
        { status: 400 }
      );
    }

    await prisma.customerMapping.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Mapping deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting mapping:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete mapping",
      },
      { status: 500 }
    );
  }
}
