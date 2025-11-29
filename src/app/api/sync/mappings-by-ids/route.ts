import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync/mappings-by-ids
 * Get mappings for specific customer IDs (efficient for pagination)
 */
export async function POST(request: NextRequest) {
  try {
    const { customerIds } = await request.json();

    if (!customerIds || !Array.isArray(customerIds)) {
      return NextResponse.json(
        { success: false, error: "customerIds array is required" },
        { status: 400 }
      );
    }

    const mappings = await prisma.customerMapping.findMany({
      where: {
        nhanhCustomerId: { in: customerIds },
      },
    });

    return NextResponse.json({
      success: true,
      data: mappings,
    });
  } catch (error: any) {
    console.error("Error getting mappings by IDs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get mappings",
      },
      { status: 500 }
    );
  }
}
