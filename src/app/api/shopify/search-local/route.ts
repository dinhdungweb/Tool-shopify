import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStoreContextOrDefault } from "@/lib/store-context";
import {
  getVietnamesePhoneSearchKey,
  getVietnamesePhoneVariations,
} from "@/lib/phone-utils";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/shopify/search-local
 * Search Shopify customers in local database
 * Searches in: phone, defaultAddressPhone, note, email
 */
export async function GET(request: NextRequest) {
  try {
    const { storeId } = await getStoreContextOrDefault(request);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!query) {
      return NextResponse.json(
        { success: false, error: "query parameter is required" },
        { status: 400 }
      );
    }

    const normalizedQuery = query.replace(/\D/g, "");
    const phoneVariations = getVietnamesePhoneVariations(query);
    const phoneSearchKey = getVietnamesePhoneSearchKey(query);
    const exactPhoneVariations = [
      ...phoneVariations,
      ...phoneVariations.map((phone) => `+${phone}`),
    ];

    const phoneFilters: Prisma.ShopifyCustomerWhereInput[] = phoneSearchKey
      ? [
          { phone: { in: exactPhoneVariations } },
          { defaultAddressPhone: { in: exactPhoneVariations } },
          // The final 9 digits are identical in 0, 84 and +84 formats.
          { phone: { contains: phoneSearchKey } },
          { defaultAddressPhone: { contains: phoneSearchKey } },
          { note: { contains: phoneSearchKey } },
        ]
      : [];

    // Search in multiple fields
    const customers = await prisma.shopifyCustomer.findMany({
      where: {
        storeId,
        OR: [
          // Email search
          { email: { contains: query, mode: "insensitive" } },
          ...phoneFilters,
          ...(normalizedQuery && !phoneSearchKey
            ? [{ note: { contains: normalizedQuery } }]
            : []),
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: customers.map((customer) => ({
        ...customer,
        id: customer.shopifyId,
      })),
    });
  } catch (error: any) {
    console.error("Error searching customers:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
