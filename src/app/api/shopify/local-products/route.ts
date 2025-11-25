// API Route: Get Shopify Products from Local Database
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const keyword = searchParams.get("keyword") || "";
    const mappingStatus = searchParams.get("mappingStatus") || "";
    const syncStatus = searchParams.get("syncStatus") || "";

    // Build where clause
    const where: any = {};

    // Keyword search
    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { sku: { contains: keyword, mode: "insensitive" } },
        { barcode: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // Get total count
    const total = await prisma.shopifyProduct.count({ where });

    // Get products with pagination
    const products = await prisma.shopifyProduct.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get all mappings to check status
    const productIds = products.map(p => p.id);
    const mappings = await prisma.productMapping.findMany({
      where: {
        shopifyProductId: { in: productIds },
      },
    });

    const mappingMap = new Map(mappings.map(m => [m.shopifyProductId, m]));

    // Filter by mapping/sync status if needed
    let filteredProducts = products;
    if (mappingStatus === "mapped") {
      filteredProducts = products.filter(p => mappingMap.has(p.id));
    } else if (mappingStatus === "unmapped") {
      filteredProducts = products.filter(p => !mappingMap.has(p.id));
    } else if (syncStatus && syncStatus !== "all") {
      filteredProducts = products.filter(p => {
        const mapping = mappingMap.get(p.id);
        return mapping && mapping.syncStatus === syncStatus.toUpperCase();
      });
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        products: filteredProducts.map((p) => ({
          id: p.id,
          title: p.title,
          handle: p.handle,
          productType: p.productType,
          vendor: p.vendor,
          tags: p.tags,
          variantId: p.variantId,
          sku: p.sku,
          barcode: p.barcode,
          price: parseFloat(p.price.toString()),
          compareAtPrice: p.compareAtPrice ? parseFloat(p.compareAtPrice.toString()) : undefined,
          inventoryQuantity: p.inventoryQuantity,
          images: p.images,
          lastPulledAt: p.lastPulledAt.toISOString(),
        })),
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error("Error fetching local Shopify products:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}
