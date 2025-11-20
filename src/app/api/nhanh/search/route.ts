import { NextRequest, NextResponse } from "next/server";
import { nhanhAPI } from "@/lib/nhanh-api";

export const dynamic = "force-dynamic";

/**
 * POST /api/nhanh/search
 * Search customers in Nhanh.vn by keyword
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: "Search query is required",
        },
        { status: 400 }
      );
    }

    const customers = await nhanhAPI.searchCustomers(query);

    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (error: any) {
    console.error("Error searching Nhanh customers:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to search customers in Nhanh.vn",
      },
      { status: 500 }
    );
  }
}
