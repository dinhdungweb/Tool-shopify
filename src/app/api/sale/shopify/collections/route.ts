// API Route: Get Shopify Collections
import { NextRequest, NextResponse } from "next/server";
import { shopifySaleAPI } from "@/lib/shopify-sale-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/sale/shopify/collections
 * Get collections from Shopify
 */
export async function GET(request: NextRequest) {
  try {
    const collections = await shopifySaleAPI.getCollections();

    return NextResponse.json({
      success: true,
      data: collections,
    });
  } catch (error: any) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch collections",
      },
      { status: 500 }
    );
  }
}
