import { NextRequest, NextResponse } from "next/server";
import { shopifyAPI } from "@/lib/shopify-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/shopify/customers
 * Get list of customers from Shopify
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");

    const customers = await shopifyAPI.getAllCustomers(limit);

    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (error: any) {
    console.error("Error fetching Shopify customers:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch customers from Shopify",
      },
      { status: 500 }
    );
  }
}
