// API Route: Get Products from Local Database
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
        { name: { contains: keyword, mode: "insensitive" } },
        { sku: { contains: keyword, mode: "insensitive" } },
        { barcode: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // Mapping status filter (one-to-many: use 'some'/'none')
    if (mappingStatus === "mapped") {
      where.mappings = { some: {} };
    } else if (mappingStatus === "unmapped") {
      where.mappings = { none: {} };
    }

    // Sync status filter
    if (syncStatus && syncStatus !== "all") {
      where.mappings = {
        some: { syncStatus: syncStatus.toUpperCase() },
      };
    }

    // Get total count
    const total = await prisma.nhanhProduct.count({ where });

    // Get products with pagination
    const products = await prisma.nhanhProduct.findMany({
      where,
      include: {
        mappings: true,
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        products: products.map((p) => ({
          id: p.nhanhId || p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          price: parseFloat(p.price.toString()),
          comparePrice: p.comparePrice ? parseFloat(p.comparePrice.toString()) : undefined,
          quantity: p.quantity,
          categoryId: p.categoryId,
          categoryName: p.categoryName,
          brandId: p.brandId,
          brandName: p.brandName,
          description: p.description,
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
    console.error("Error fetching local products:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}
