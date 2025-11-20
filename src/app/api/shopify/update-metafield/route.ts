import { NextRequest, NextResponse } from "next/server";
import { shopifyAPI } from "@/lib/shopify-api";

export const dynamic = "force-dynamic";

/**
 * POST /api/shopify/update-metafield
 * Update customer metafield in Shopify
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, namespace, key, value, type } = body;

    if (!customerId || !namespace || !key || value === undefined || !type) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: customerId, namespace, key, value, type",
        },
        { status: 400 }
      );
    }

    const success = await shopifyAPI.updateCustomerMetafield(customerId, {
      namespace,
      key,
      value: value.toString(),
      type,
    });

    return NextResponse.json({
      success,
      message: success
        ? "Metafield updated successfully"
        : "Failed to update metafield",
    });
  } catch (error: any) {
    console.error("Error updating Shopify metafield:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update customer metafield",
      },
      { status: 500 }
    );
  }
}
