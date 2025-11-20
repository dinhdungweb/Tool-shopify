import { NextRequest, NextResponse } from "next/server";
import { shopifyAPI } from "@/lib/shopify-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/shopify/customer/[id]
 * Get customer detail from Shopify
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await shopifyAPI.getCustomerById(id);

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error: any) {
    console.error("Error fetching Shopify customer:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch customer from Shopify",
      },
      { status: 500 }
    );
  }
}
