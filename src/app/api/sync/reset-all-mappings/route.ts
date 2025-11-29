import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync/reset-all-mappings
 * Delete ALL customer mappings and sync logs
 * WARNING: This will delete all mapping data!
 */
export async function POST() {
  try {
    console.log("🗑️ Deleting all customer mappings...");

    // Delete all sync logs first (foreign key constraint)
    const syncLogsResult = await prisma.syncLog.deleteMany({});
    console.log(`✅ Deleted ${syncLogsResult.count} sync logs`);

    // Delete all customer mappings
    const mappingsResult = await prisma.customerMapping.deleteMany({});
    console.log(`✅ Deleted ${mappingsResult.count} customer mappings`);

    return NextResponse.json({
      success: true,
      data: {
        syncLogsDeleted: syncLogsResult.count,
        mappingsDeleted: mappingsResult.count,
      },
      message: `Reset completed! Deleted ${mappingsResult.count} mappings and ${syncLogsResult.count} sync logs`,
    });
  } catch (error: any) {
    console.error("Error resetting mappings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to reset mappings",
      },
      { status: 500 }
    );
  }
}
