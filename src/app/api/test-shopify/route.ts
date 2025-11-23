// Test Shopify API connection
import { NextResponse } from "next/server";
import { shopifySaleAPI } from "@/lib/shopify-sale-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log("Testing Shopify API connection...");
    
    // Test 1: Get products
    const productsResult = await shopifySaleAPI.getProducts({ first: 5 });
    console.log("Products fetched:", productsResult.products.length);
    
    // Test 2: Get collections
    const collections = await shopifySaleAPI.getCollections();
    console.log("Collections fetched:", collections.length);
    
    return NextResponse.json({
      success: true,
      data: {
        productsCount: productsResult.products.length,
        collectionsCount: collections.length,
        sampleProducts: productsResult.products.slice(0, 2),
        sampleCollections: collections.slice(0, 2),
      },
    });
  } catch (error: any) {
    console.error("Shopify API test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
