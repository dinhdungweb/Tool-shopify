// API Route: Get Shopify Products
import { NextRequest, NextResponse } from "next/server";
import { shopifySaleAPI } from "@/lib/shopify-sale-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/sale/shopify/products
 * Get products from Shopify
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query") || undefined;
    const first = parseInt(searchParams.get("first") || "50");
    const after = searchParams.get("after") || undefined;

    const result = await shopifySaleAPI.getProducts({ first, after, query });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}
