import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/shopify/search-local
 * Search Shopify customers in local database
 * Searches in: phone, defaultAddressPhone, note, email
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!query) {
      return NextResponse.json(
        { success: false, error: "query parameter is required" },
        { status: 400 }
      );
    }

    // Normalize phone for search
    const normalizedQuery = query.replace(/[\s\-\(\)\+]/g, "");
    const phoneVariations = [normalizedQuery];
    
    if (normalizedQuery.startsWith("0")) {
      phoneVariations.push("84" + normalizedQuery.substring(1));
    } else if (normalizedQuery.startsWith("84")) {
      phoneVariations.push("0" + normalizedQuery.substring(2));
    }

    // Search in multiple fields
    const customers = await prisma.shopifyCustomer.findMany({
      where: {
        OR: [
          // Email search
          { email: { contains: query, mode: "insensitive" } },
          // Phone search
          { phone: { in: phoneVariations } },
          // Default address phone search
          { defaultAddressPhone: { in: phoneVariations } },
          // Note search (for phone numbers)
          { note: { contains: normalizedQuery } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (error: any) {
    console.error("Error searching customers:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
