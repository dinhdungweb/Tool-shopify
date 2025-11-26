import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync/schedule/products
 * Get product auto-sync schedule configuration
 */
export async function GET() {
  try {
    const config = await prisma.syncSchedule.findUnique({
      where: { id: "product_auto_sync" },
    });

    if (!config) {
      // Return default config
      return NextResponse.json({
        success: true,
        data: {
          enabled: false,
          schedule: "0 */6 * * *", // Every 6 hours by default
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        enabled: config.enabled,
        schedule: config.schedule,
      },
    });
  } catch (error: any) {
    console.error("Error getting product sync schedule:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get schedule",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/schedule/products
 * Update product auto-sync schedule configuration
 */
export async function POST(request: NextRequest) {
  try {
    const { enabled, schedule } = await request.json();

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    if (!schedule || typeof schedule !== "string") {
      return NextResponse.json(
        { success: false, error: "schedule is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate cron expression (basic validation)
    const cronParts = schedule.trim().split(/\s+/);
    if (cronParts.length !== 5) {
      return NextResponse.json(
        { success: false, error: "Invalid cron expression (must have 5 parts)" },
        { status: 400 }
      );
    }

    // Upsert configuration
    await prisma.syncSchedule.upsert({
      where: { id: "product_auto_sync" },
      create: {
        id: "product_auto_sync",
        enabled,
        schedule,
        type: "PRODUCT",
      },
      update: {
        enabled,
        schedule,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: enabled
        ? `Product auto-sync enabled with schedule: ${schedule}`
        : "Product auto-sync disabled",
    });
  } catch (error: any) {
    console.error("Error updating product sync schedule:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update schedule",
      },
      { status: 500 }
    );
  }
}
