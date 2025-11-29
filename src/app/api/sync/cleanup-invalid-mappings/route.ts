import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync/cleanup-invalid-mappings
 * Delete mappings that don't have a shopifyCustomerId
 */
export async function POST() {
  try {
    console.log("🧹 Cleaning up invalid mappings...");

    // Delete mappings without shopifyCustomerId
    const result = await prisma.customerMapping.deleteMany({
      where: {
        shopifyCustomerId: null,
      },
    });

    console.log(`✅ Deleted ${result.count} invalid mappings`);

    return NextResponse.json({
      success: true,
      data: {
        deleted: result.count,
      },
      message: `Cleaned up ${result.count} invalid mappings`,
    });
  } catch (error: any) {
    console.error("Error cleaning up mappings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to cleanup mappings",
      },
      { status: 500 }
    );
  }
}
