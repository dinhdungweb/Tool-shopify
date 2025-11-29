import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/nhanh/local-customers
 * Get customers from local database with pagination and search
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const keyword = searchParams.get("keyword") || "";
    const mappingStatus = searchParams.get("mappingStatus") || "";
    const syncStatus = searchParams.get("syncStatus") || "";

    // Build where clause for search and filter
    const where: any = {};
    
    // Search filter
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" as const } },
        { phone: { contains: keyword, mode: "insensitive" as const } },
        { email: { contains: keyword, mode: "insensitive" as const } },
      ];
    }

    // Combined mapping and sync status filter
    if (syncStatus && syncStatus !== "all") {
      // If filtering by sync status, we need a mapping with that status
      where.AND = [
        { mapping: { isNot: null } },
        { mapping: { syncStatus: syncStatus.toUpperCase() } },
        { mapping: { shopifyCustomerId: { not: null } } },
      ];
    } else if (mappingStatus === "mapped") {
      // Only show customers with valid mappings (has shopifyCustomerId)
      where.AND = [
        { mapping: { isNot: null } },
        { mapping: { shopifyCustomerId: { not: null } } },
      ];
    } else if (mappingStatus === "unmapped") {
      where.mapping = null;
    }

    // Get total count
    const total = await prisma.nhanhCustomer.count({ where });

    // Get paginated customers
    const customers = await prisma.nhanhCustomer.findMany({
      where,
      orderBy: { totalSpent: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        mapping: true,
      },
    });

    // Transform to match NhanhCustomer type
    const transformedCustomers = customers.map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || undefined,
      email: c.email || undefined,
      totalSpent: Number(c.totalSpent),
      address: c.address || undefined,
      city: c.city || undefined,
      district: c.district || undefined,
      ward: c.ward || undefined,
    }));

    return NextResponse.json({
      success: true,
      data: {
        customers: transformedCustomers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching local customers:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch customers from database",
      },
      { status: 500 }
    );
  }
}
