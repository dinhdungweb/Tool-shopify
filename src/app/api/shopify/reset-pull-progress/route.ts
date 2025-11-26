import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/shopify/reset-pull-progress
 * Reset Shopify pull progress to start from beginning
 * Query param: type=customers|products (default: both)
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'both';

    let deleted = 0;

    if (type === 'customers' || type === 'both') {
      try {
        await prisma.pullProgress.delete({
          where: { id: "shopify_customers" },
        });
        deleted++;
      } catch (error: any) {
        if (error.code !== "P2025") throw error;
      }
    }

    if (type === 'products' || type === 'both') {
      try {
        await prisma.pullProgress.delete({
          where: { id: "shopify_products" },
        });
        deleted++;
      } catch (error: any) {
        if (error.code !== "P2025") throw error;
      }
    }

    return NextResponse.json({
      success: true,
      message: deleted > 0 
        ? `Shopify ${type} pull progress reset. Next pull will start from beginning.`
        : "No progress to reset.",
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
