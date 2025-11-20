import { NextRequest, NextResponse } from "next/server";
import { nhanhAPI } from "@/lib/nhanh-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/nhanh/customer/[id]
 * Get customer detail from Nhanh.vn
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await nhanhAPI.getCustomerById(id);

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error: any) {
    console.error("Error fetching Nhanh customer:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch customer from Nhanh.vn",
      },
      { status: 500 }
    );
  }
}
