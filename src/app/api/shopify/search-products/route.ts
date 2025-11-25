// API Route: Search Shopify Products
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword, sku, barcode } = body;

    if (!keyword && !sku && !barcode) {
      return NextResponse.json(
        {
          success: false,
          error: "Keyword, SKU, or barcode is required",
        },
        { status: 400 }
      );
    }

    // Search in local database
    const where: any = {};

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { sku: { contains: keyword, mode: "insensitive" } },
        { barcode: { contains: keyword, mode: "insensitive" } },
      ];
    } else if (sku) {
      where.sku = { equals: sku, mode: "insensitive" };
    } else if (barcode) {
      where.barcode = { equals: barcode, mode: "insensitive" };
    }

    const products = await prisma.shopifyProduct.findMany({
      where,
      take: 20,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: products.map((p) => ({
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
      })),
    });
  } catch (error: any) {
    console.error("Error searching Shopify products:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to search products",
      },
      { status: 500 }
    );
  }
}
