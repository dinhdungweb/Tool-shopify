import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/nhanh/reset-pull-progress
 * Reset Nhanh pull progress to start from beginning
 * Query param: type=customers|products (default: both)
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'both';

    let deleted = 0;

    if (type === 'customers' || type === 'both') {
      // Delete all customer pull progress (including filtered ones)
      const result = await prisma.pullProgress.deleteMany({
        where: {
          id: {
            startsWith: "nhanh_customers"
          }
        }
      });
      deleted += result.count;
    }

    if (type === 'products' || type === 'both') {
      // Delete all product pull progress
      const result = await prisma.pullProgress.deleteMany({
        where: {
          id: {
            startsWith: "nhanh_products"
          }
        }
      });
      deleted += result.count;
    }

    return NextResponse.json({
      success: true,
      message: deleted > 0 
        ? `Nhanh ${type} pull progress reset. Next pull will start from beginning.`
        : "No progress to reset.",
    });
  } catch (error: any) {
    console.error("Error resetting Nhanh pull progress:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to reset pull progress",
      },
      { status: 500 }
    );
  }
}
