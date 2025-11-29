// API Route: Fix missing shopifyVariantIds in product mappings
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    console.log("🔧 Fixing missing shopifyVariantIds...");

    // Get all mappings with shopifyProductId but no shopifyVariantId
    const mappings = await prisma.productMapping.findMany({
      where: {
        shopifyProductId: { not: null },
        shopifyVariantId: null,
      },
      select: {
        id: true,
        shopifyProductId: true,
      },
    });

    console.log(`📊 Found ${mappings.length} mappings to fix`);

    if (mappings.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No mappings need fixing",
        data: {
          fixed: 0,
          failed: 0,
          total: 0,
        },
      });
    }

    let fixed = 0;
    let failed = 0;

    // Update each mapping: set shopifyVariantId = shopifyProductId
    // (In Shopify, each variant has its own ID, and we store variants as products)
    for (const mapping of mappings) {
      try {
        await prisma.productMapping.update({
          where: { id: mapping.id },
          data: {
            shopifyVariantId: mapping.shopifyProductId,
          },
        });
        fixed++;
      } catch (error: any) {
        console.error(`Failed to fix mapping ${mapping.id}:`, error.message);
        failed++;
      }
    }

    console.log(`✅ Fix completed: ${fixed} fixed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixed} mappings`,
      data: {
        fixed,
        failed,
        total: mappings.length,
      },
    });
  } catch (error: any) {
    console.error("Error fixing variant IDs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fix variant IDs",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check how many mappings need fixing
export async function GET(request: NextRequest) {
  try {
    const count = await prisma.productMapping.count({
      where: {
        shopifyProductId: { not: null },
        shopifyVariantId: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        needsFix: count,
        message: count > 0 
          ? `${count} mappings need fixing` 
          : "All mappings are OK",
      },
    });
  } catch (error: any) {
    console.error("Error checking variant IDs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to check variant IDs",
      },
      { status: 500 }
    );
  }
}
