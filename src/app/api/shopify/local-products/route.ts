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

    // Build where clause for search
    const where: any = {};

    // Keyword search
    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { sku: { contains: keyword, mode: "insensitive" } },
        { barcode: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // Handle mapping/sync status filter
    let productIds: string[] | undefined;
    
    if (syncStatus && syncStatus !== "all") {
      // Get product IDs with specific sync status
      const mappings = await prisma.productMapping.findMany({
        where: { syncStatus: syncStatus.toUpperCase() as any },
        select: { shopifyProductId: true },
      });
      productIds = mappings.map(m => m.shopifyProductId).filter((id): id is string => !!id);
      where.id = { in: productIds };
    } else if (mappingStatus === "mapped") {
      // Get all mapped product IDs
      const mappings = await prisma.productMapping.findMany({
        where: { shopifyProductId: { not: null } },
        select: { shopifyProductId: true },
      });
      productIds = mappings.map(m => m.shopifyProductId).filter((id): id is string => !!id);
      where.id = { in: productIds };
    } else if (mappingStatus === "unmapped") {
      // Get all mapped product IDs to exclude
      const mappings = await prisma.productMapping.findMany({
        where: { shopifyProductId: { not: null } },
        select: { shopifyProductId: true },
      });
      const mappedIds = mappings.map(m => m.shopifyProductId).filter((id): id is string => !!id);
      where.id = { notIn: mappedIds };
    }

    // Get total count
    const total = await prisma.shopifyProduct.count({ where });

    // Get products with pagination
    const products = await prisma.shopifyProduct.findMany({
      where,
      orderBy: { lastPulledAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        products: products.map((p) => ({
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
