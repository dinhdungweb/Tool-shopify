// API Route: Test Shopify Connection
import { NextResponse } from "next/server";
import { shopifyAPI } from "@/lib/shopify-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Try to fetch shop info to test connection
    const shop = await shopifyAPI.getShopInfo();
    
    return NextResponse.json({
      success: true,
      message: "Shopify connection successful",
      data: {
        connected: true,
        shopName: shop.name,
        shopDomain: shop.domain,
        email: shop.email,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to connect to Shopify",
        details: {
          storeUrl: process.env.SHOPIFY_STORE_URL,
          hasAccessToken: !!process.env.SHOPIFY_ACCESS_TOKEN,
          apiVersion: process.env.SHOPIFY_API_VERSION,
        },
      },
      { status: 500 }
    );
  }
}
