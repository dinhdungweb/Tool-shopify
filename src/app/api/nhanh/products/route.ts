// API Route: Get Nhanh Products
import { NextRequest, NextResponse } from "next/server";
import { nhanhProductAPI } from "@/lib/nhanh-product-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const keyword = searchParams.get("keyword") || undefined;
    const nextParam = searchParams.get("next");
    const next = nextParam ? JSON.parse(nextParam) : undefined;

    const result = await nhanhProductAPI.getProducts({
      page,
      limit,
      keyword,
      next,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error fetching Nhanh products:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}
