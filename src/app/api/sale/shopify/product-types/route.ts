// API Route: Get Shopify Product Types
import { NextRequest, NextResponse } from "next/server";
import { shopifySaleAPI } from "@/lib/shopify-sale-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/sale/shopify/product-types
 * Get all product types from Shopify
 */
export async function GET(request: NextRequest) {
  try {
    const productTypes = await shopifySaleAPI.getProductTypes();

    return NextResponse.json({
      success: true,
      data: productTypes,
    });
  } catch (error: any) {
    console.error("Error fetching product types:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch product types",
      },
      { status: 500 }
    );
  }
}
