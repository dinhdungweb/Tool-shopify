import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync/mapping-stats
 * Get mapping statistics (counts by status)
 */
export async function GET(request: NextRequest) {
  try {
    const [total, synced, pending, failed] = await Promise.all([
      prisma.customerMapping.count(),
      prisma.customerMapping.count({ where: { syncStatus: SyncStatus.SYNCED } }),
      prisma.customerMapping.count({ where: { syncStatus: SyncStatus.PENDING } }),
      prisma.customerMapping.count({ where: { syncStatus: SyncStatus.FAILED } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total,
        synced,
        pending,
        failed,
        unmapped: 0, // Will be calculated separately if needed
      },
    });
  } catch (error: any) {
    console.error("Error getting mapping stats:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get mapping stats",
      },
      { status: 500 }
    );
  }
}
