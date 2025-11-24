import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/nhanh/reset-pull-progress
 * Reset pull progress to start from beginning
 */
export async function POST() {
  try {
    await prisma.pullProgress.delete({
      where: { id: "nhanh_customers" },
    });

    return NextResponse.json({
      success: true,
      message: "Pull progress reset. Next pull will start from beginning.",
    });
  } catch (error: any) {
    // If record doesn't exist, that's fine
    if (error.code === "P2025") {
      return NextResponse.json({
        success: true,
        message: "No progress to reset.",
      });
    }

    console.error("Error resetting pull progress:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to reset pull progress",
      },
      { status: 500 }
    );
  }
}
