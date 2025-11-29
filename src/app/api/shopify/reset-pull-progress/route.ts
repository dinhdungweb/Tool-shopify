import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/shopify/reset-pull-progress
 * Reset Shopify pull progress (customers or products)
 * Query param: ?type=customers or ?type=products (defaults to customers)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "customers";
    
    const progressId = type === "products" ? "shopify_products" : "shopify_customers";
    
    // Delete the specific pull progress record
    const deleted = await prisma.pullProgress.deleteMany({
      where: {
        id: progressId,
      },
    });

    console.log(`🔄 Reset Shopify ${type} pull progress: ${deleted.count} records deleted`);

    return NextResponse.json({
      success: true,
      message: `Shopify ${type} pull progress reset successfully. ${deleted.count} progress record(s) deleted.`,
      data: {
        deletedCount: deleted.count,
        type,
      },
    });
  } catch (error: any) {
    console.error("Error resetting Shopify pull progress:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to reset pull progress",
      },
      { status: 500 }
    );
  }
}
