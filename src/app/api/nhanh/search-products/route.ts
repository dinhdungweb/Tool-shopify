// API Route: Search Nhanh Products
import { NextRequest, NextResponse } from "next/server";
import { nhanhProductAPI } from "@/lib/nhanh-product-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword } = body;

    if (!keyword) {
      return NextResponse.json(
        {
          success: false,
          error: "Keyword is required",
        },
        { status: 400 }
      );
    }

    const products = await nhanhProductAPI.searchProducts(keyword);

    return NextResponse.json({
      success: true,
      data: products,
    });
  } catch (error: any) {
    console.error("Error searching Nhanh products:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to search products",
      },
      { status: 500 }
    );
  }
}
