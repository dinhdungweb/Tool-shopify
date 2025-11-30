import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get("filter") || "all";
    const keyword = searchParams.get("keyword") || "";

    // Build query based on filter
    let productIds: string[] = [];
    
    // If filtering by mapping status, get product IDs from mappings first
    if (filter === "mapped") {
      const mappings = await prisma.productMapping.findMany({
        where: {
          shopifyProductId: { not: null },
        },
        select: { shopifyProductId: true },
        take: 10000,
      });
      productIds = mappings.map(m => m.shopifyProductId).filter((id): id is string => !!id);
    } else if (filter === "pending" || filter === "synced" || filter === "failed") {
      const mappings = await prisma.productMapping.findMany({
        where: {
          shopifyProductId: { not: null },
          syncStatus: filter.toUpperCase() as any,
        },
        select: { shopifyProductId: true },
        take: 10000,
      });
      productIds = mappings.map(m => m.shopifyProductId).filter((id): id is string => !!id);
    }

    // Build where clause for products
    const where: any = {};

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { sku: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // Apply mapping filter
    if (filter === "mapped" || filter === "pending" || filter === "synced" || filter === "failed") {
      where.id = { in: productIds };
    } else if (filter === "unmapped") {
      // Get all mapped product IDs
      const allMappings = await prisma.productMapping.findMany({
        where: { shopifyProductId: { not: null } },
        select: { shopifyProductId: true },
      });
      const mappedIds = allMappings.map(m => m.shopifyProductId).filter((id): id is string => !!id);
      where.id = { notIn: mappedIds };
    }

    // Get products
    const products = await prisma.shopifyProduct.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000, // Limit for safety
    });

    // Get mappings for these products
    const mappings = await prisma.productMapping.findMany({
      where: {
        shopifyProductId: {
          in: products.map(p => p.id),
        },
      },
      include: {
        nhanhProduct: true,
      },
    });

    // Create mapping lookup
    const mappingMap = new Map(
      mappings.map(m => [m.shopifyProductId, m])
    );

    // Combine products with mappings
    const filteredProducts = products.map(product => ({
      ...product,
      mapping: mappingMap.get(product.id),
    }));

    // Format data for export
    const exportData = filteredProducts.map(product => ({
      "Shopify ID": product.id,
      "Title": product.title,
      "SKU": product.sku || "",
      "Price": product.price.toString(),
      "Inventory": product.inventoryQuantity || 0,
      "Mapped": product.mapping ? "Yes" : "No",
      "Nhanh Product": product.mapping?.nhanhProduct?.name || "",
      "Nhanh SKU": product.mapping?.nhanhProduct?.sku || "",
      "Sync Status": product.mapping?.syncStatus || "",
      "Last Synced": product.mapping?.lastSyncedAt 
        ? new Date(product.mapping.lastSyncedAt).toLocaleString("vi-VN")
        : "",
      "Created At": new Date(product.createdAt).toLocaleString("vi-VN"),
    }));

    return NextResponse.json({
      success: true,
      data: exportData,
      total: exportData.length,
    });
  } catch (error: any) {
    console.error("Error exporting products:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
