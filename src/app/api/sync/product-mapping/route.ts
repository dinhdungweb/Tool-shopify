// API Route: Product Mapping CRUD
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

/**
 * GET /api/sync/product-mapping
 * Get all product mappings with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status") || "";

    const where: any = {};
    if (status) {
      where.syncStatus = status.toUpperCase();
    }

    const total = await prisma.productMapping.count({ where });
    const mappings = await prisma.productMapping.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: {
        mappings: mappings.map((m) => ({
          ...m,
          nhanhPrice: parseFloat(m.nhanhPrice.toString()),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching product mappings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch mappings",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/product-mapping
 * Create a new product mapping
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      nhanhProductId,
      nhanhProductName,
      nhanhSku,
      nhanhBarcode,
      nhanhPrice,
      shopifyProductId,
      shopifyVariantId,
      shopifyProductTitle,
      shopifySku,
      shopifyBarcode,
    } = body;

    if (!nhanhProductId || !nhanhProductName) {
      return NextResponse.json(
        {
          success: false,
          error: "Nhanh product ID and name are required",
        },
        { status: 400 }
      );
    }

    // Check if mapping already exists
    const existing = await prisma.productMapping.findUnique({
      where: { nhanhProductId },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping already exists for this product",
        },
        { status: 400 }
      );
    }

    const mapping = await prisma.productMapping.create({
      data: {
        nhanhProductId,
        nhanhProductName,
        nhanhSku,
        nhanhBarcode,
        nhanhPrice: nhanhPrice || 0,
        shopifyProductId,
        shopifyVariantId,
        shopifyProductTitle,
        shopifySku,
        shopifyBarcode,
        syncStatus: shopifyProductId ? "PENDING" : "UNMAPPED",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...mapping,
        nhanhPrice: parseFloat(mapping.nhanhPrice.toString()),
      },
    });
  } catch (error: any) {
    console.error("Error creating product mapping:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create mapping",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sync/product-mapping
 * Update a product mapping
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping ID is required",
        },
        { status: 400 }
      );
    }

    const mapping = await prisma.productMapping.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...mapping,
        nhanhPrice: parseFloat(mapping.nhanhPrice.toString()),
      },
    });
  } catch (error: any) {
    console.error("Error updating product mapping:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update mapping",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sync/product-mapping
 * Delete a product mapping
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping ID is required",
        },
        { status: 400 }
      );
    }

    await prisma.productMapping.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Mapping deleted successfully" },
    });
  } catch (error: any) {
    console.error("Error deleting product mapping:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete mapping",
      },
      { status: 500 }
    );
  }
}
