import { NextRequest, NextResponse } from "next/server";
import { nhanhAPI } from "@/lib/nhanh-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/nhanh/customers
 * Get list of customers from Nhanh.vn
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const keyword = searchParams.get("keyword") || "";
    const nextCursor = searchParams.get("next");
    const fetchAll = searchParams.get("fetchAll") === "true";

    // If fetchAll is requested, get all customers
    if (fetchAll) {
      const allCustomers = await nhanhAPI.getAllCustomers(100);
      return NextResponse.json({
        success: true,
        data: {
          customers: allCustomers,
          total: allCustomers.length,
          page: 1,
          limit: allCustomers.length,
          hasMore: false,
        },
      });
    }

    // Otherwise, use cursor-based pagination
    let parsedNext = undefined;
    if (nextCursor && nextCursor !== "undefined" && nextCursor !== "null") {
      try {
        parsedNext = JSON.parse(nextCursor);
        console.log("Parsed next cursor:", parsedNext);
      } catch (e) {
        console.error("Error parsing next cursor:", e);
        console.error("Next cursor value:", nextCursor);
      }
    }

    const result = await nhanhAPI.getCustomers({
      page,
      limit,
      name: keyword,
      next: parsedNext,
    });
    
    console.log("API Response:", {
      customersCount: result.customers.length,
      hasMore: result.hasMore,
      hasNext: !!result.next,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error fetching Nhanh customers:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch customers from Nhanh.vn",
      },
      { status: 500 }
    );
  }
}
