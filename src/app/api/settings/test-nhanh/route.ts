// API Route: Test Nhanh.vn Connection
import { NextResponse } from "next/server";
import { nhanhAPI } from "@/lib/nhanh-api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Try to fetch a small amount of data to test connection
    const response = await nhanhAPI.getCustomers({ limit: 1 });
    
    return NextResponse.json({
      success: true,
      message: "Nhanh.vn connection successful",
      data: {
        connected: true,
        apiUrl: process.env.NHANH_API_URL,
        businessId: process.env.NHANH_BUSINESS_ID,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to connect to Nhanh.vn",
        details: {
          apiUrl: process.env.NHANH_API_URL,
          hasAppId: !!process.env.NHANH_APP_ID,
          hasBusinessId: !!process.env.NHANH_BUSINESS_ID,
          hasAccessToken: !!process.env.NHANH_ACCESS_TOKEN,
        },
      },
      { status: 500 }
    );
  }
}
