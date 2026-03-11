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

    // Apply mapping/sync status filter (one-to-many syntax)
    if (filter === "mapped") {
      where.AND = [
        { mappings: { some: {} } },
        { mappings: { some: { shopifyCustomerId: { not: null } } } },
      ];
    } else if (filter === "unmapped") {
      where.mappings = { none: {} };
    } else if (filter === "pending" || filter === "synced" || filter === "failed") {
      where.AND = [
        { mappings: { some: {} } },
        { mappings: { some: { syncStatus: filter.toUpperCase() } } },
        { mappings: { some: { shopifyCustomerId: { not: null } } } },
      ];
    }

    // Get customers with mappings
    const filteredCustomers = await prisma.nhanhCustomer.findMany({
      where,
      include: {
        mappings: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    // Format data for export
    const exportData = filteredCustomers.map(customer => {
      const mapping = (customer as any).mappings?.[0] || null;
      return {
        "Nhanh ID": (customer as any).nhanhId || customer.id,
        "Name": customer.name,
        "Phone": customer.phone || "",
        "Email": customer.email || "",
        "Address": customer.address || "",
        "City": customer.city || "",
        "District": customer.district || "",
        "Ward": customer.ward || "",
        "Mapped": mapping ? "Yes" : "No",
        "Shopify Customer ID": mapping?.shopifyCustomerId || "",
        "Shopify Customer Name": mapping?.shopifyCustomerName || "",
        "Shopify Email": mapping?.shopifyCustomerEmail || "",
        "Sync Status": mapping?.syncStatus || "",
        "Last Synced": mapping?.lastSyncedAt
          ? new Date(mapping.lastSyncedAt).toLocaleString("vi-VN")
          : "",
        "Created At": new Date(customer.createdAt).toLocaleString("vi-VN"),
      };
    });

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
