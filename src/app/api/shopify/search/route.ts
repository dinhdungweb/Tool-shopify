import { NextRequest, NextResponse } from "next/server";
import { shopifyAPI } from "@/lib/shopify-api";

export const dynamic = "force-dynamic";

/**
 * POST /api/shopify/search
 * Search customers in Shopify by email or phone
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, email, phone } = body;

    if (!query && !email && !phone) {
      return NextResponse.json(
        {
          success: false,
          error: "Search query, email, or phone is required",
        },
        { status: 400 }
      );
    }

    const customers = await shopifyAPI.searchCustomers({
      query,
      email,
      phone,
      limit: 20,
    });

    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (error: any) {
    console.error("Error searching Shopify customers:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to search customers in Shopify",
      },
      { status: 500 }
    );
  }
}
