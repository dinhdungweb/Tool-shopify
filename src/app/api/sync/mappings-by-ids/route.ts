import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStoreContextOrDefault } from "@/lib/store-context";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync/mappings-by-ids
 * Get mappings for specific customer IDs (efficient for pagination)
 */
export async function POST(request: NextRequest) {
  try {
    const { storeId } = await getStoreContextOrDefault(request);
    const { customerIds } = await request.json();

    if (!customerIds || !Array.isArray(customerIds)) {
      return NextResponse.json(
        { success: false, error: "customerIds array is required" },
        { status: 400 }
      );
    }

    const mappings = await prisma.customerMapping.findMany({
      where: {
        storeId,
        nhanhCustomer: {
          is: {
            storeId,
            OR: [
              { nhanhId: { in: customerIds } },
              { id: { in: customerIds } },
            ],
          },
        },
      },
      include: {
        nhanhCustomer: { select: { nhanhId: true } },
      },
    });

    // The customer table is keyed by the original Nhanh ID in the browser.
    const responseMappings = mappings.map(({ nhanhCustomer, ...mapping }) => ({
      ...mapping,
      nhanhCustomerId: nhanhCustomer.nhanhId,
    }));

    return NextResponse.json({
      success: true,
      data: responseMappings,
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
