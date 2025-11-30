import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get("filter") || "all";
    const keyword = searchParams.get("keyword") || "";

    // Build query based on filter
    const where: any = {};

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { phone: { contains: keyword, mode: "insensitive" } },
        { email: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // Apply mapping/sync status filter in database query
    if (filter === "mapped") {
      where.AND = [
        { mapping: { isNot: null } },
        { mapping: { shopifyCustomerId: { not: null } } },
      ];
    } else if (filter === "unmapped") {
      where.mapping = null;
    } else if (filter === "pending" || filter === "synced" || filter === "failed") {
      where.AND = [
        { mapping: { isNot: null } },
        { mapping: { syncStatus: filter.toUpperCase() } },
        { mapping: { shopifyCustomerId: { not: null } } },
      ];
    }

    // Get customers with mappings (using database filter)
    const filteredCustomers = await prisma.nhanhCustomer.findMany({
      where,
      include: {
        mapping: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10000, // Limit for safety
    });

    // Format data for export
    const exportData = filteredCustomers.map(customer => ({
      "Nhanh ID": customer.id,
      "Name": customer.name,
      "Phone": customer.phone || "",
      "Email": customer.email || "",
      "Address": customer.address || "",
      "City": customer.city || "",
      "District": customer.district || "",
      "Ward": customer.ward || "",
      "Mapped": customer.mapping ? "Yes" : "No",
      "Shopify Customer ID": customer.mapping?.shopifyCustomerId || "",
      "Shopify Customer Name": customer.mapping?.shopifyCustomerName || "",
      "Shopify Email": customer.mapping?.shopifyCustomerEmail || "",
      "Sync Status": customer.mapping?.syncStatus || "",
      "Last Synced": customer.mapping?.lastSyncedAt 
        ? new Date(customer.mapping.lastSyncedAt).toLocaleString("vi-VN")
        : "",
      "Created At": new Date(customer.createdAt).toLocaleString("vi-VN"),
    }));

    return NextResponse.json({
      success: true,
      data: exportData,
      total: exportData.length,
    });
  } catch (error: any) {
    console.error("Error exporting customers:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
