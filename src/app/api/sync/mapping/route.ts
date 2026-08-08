import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";
import { getStoreContextOrDefault } from "@/lib/store-context";
import { findShopifyCustomerMappingConflicts } from "@/lib/shopify-customer-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync/mapping
 * Get all customer mappings
 */
export async function GET(request: NextRequest) {
  try {
    const { storeId } = await getStoreContextOrDefault(request);
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status") as SyncStatus | null;

    const skip = (page - 1) * limit;

    const where = status ? { storeId, syncStatus: status } : { storeId };

    const [mappings, total] = await Promise.all([
      prisma.customerMapping.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customerMapping.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        mappings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching mappings:", error);
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
 * POST /api/sync/mapping
 * Create a new customer mapping
 */
export async function POST(request: NextRequest) {
  try {
    const { storeId } = await getStoreContextOrDefault(request);
    const body = await request.json();
    const {
      nhanhCustomerId,
      shopifyCustomerId,
      shopifyCustomerEmail,
      shopifyCustomerName,
    } = body;

    if (!nhanhCustomerId) {
      return NextResponse.json(
        {
          success: false,
          error: "nhanhCustomerId is required",
        },
        { status: 400 }
      );
    }

    // The UI uses the original Nhanh ID, while the mapping relation stores the
    // local NhanhCustomer primary key. Resolve either form and always persist
    // the local key so the foreign-key relation remains valid.
    const nhanhCustomer = await prisma.nhanhCustomer.findFirst({
      where: {
        storeId,
        OR: [
          { id: nhanhCustomerId },
          { nhanhId: nhanhCustomerId },
        ],
      },
    });

    if (!nhanhCustomer) {
      return NextResponse.json(
        {
          success: false,
          error: "Nhanh customer was not found in the active store. Pull customers again before creating the mapping.",
        },
        { status: 404 }
      );
    }

    const shopifyCustomer = shopifyCustomerId
      ? await prisma.shopifyCustomer.findFirst({
          where: {
            storeId,
            OR: [
              { id: shopifyCustomerId },
              { shopifyId: shopifyCustomerId },
            ],
          },
        })
      : null;

    if (shopifyCustomerId && !shopifyCustomer) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopify customer was not found in the active store. Pull Shopify customers again before creating the mapping.",
        },
        { status: 404 }
      );
    }

    if (shopifyCustomer) {
      const conflicts = await findShopifyCustomerMappingConflicts(
        storeId,
        shopifyCustomer.shopifyId
      );

      if (conflicts.length > 0) {
        const owner = conflicts[0];
        const shopifyName = `${shopifyCustomer.firstName || ""} ${shopifyCustomer.lastName || ""}`.trim() || shopifyCustomer.email || shopifyCustomer.shopifyId;
        return NextResponse.json(
          {
            success: false,
            code: "SHOPIFY_CUSTOMER_ALREADY_MAPPED",
            error: `Không thể liên kết Shopify customer "${shopifyName}" vì customer này đã được liên kết với Nhanh customer "${owner.nhanhCustomerName}" (Nhanh ID: ${owner.nhanhCustomer.nhanhId}). Hãy xóa mapping cũ trước khi liên kết lại.`,
            details: {
              shopifyCustomerId: shopifyCustomer.shopifyId,
              existingMappingId: owner.id,
              existingNhanhCustomerId: owner.nhanhCustomer.nhanhId,
              existingNhanhCustomerName: owner.nhanhCustomerName,
            },
          },
          { status: 409 }
        );
      }
    }

    // Check if mapping already exists
    const existing = await prisma.customerMapping.findUnique({
      where: {
        storeId_nhanhCustomerId: {
          storeId,
          nhanhCustomerId: nhanhCustomer.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping already exists for this Nhanh customer",
        },
        { status: 409 }
      );
    }

    const mapping = await prisma.customerMapping.create({
      data: {
        storeId,
        nhanhCustomerId: nhanhCustomer.id,
        nhanhCustomerName: nhanhCustomer.name,
        nhanhCustomerPhone: nhanhCustomer.phone,
        nhanhCustomerEmail: nhanhCustomer.email,
        nhanhTotalSpent: nhanhCustomer.totalSpent,
        shopifyCustomerId: shopifyCustomer?.shopifyId,
        shopifyCustomerEmail: shopifyCustomer?.email || shopifyCustomerEmail,
        shopifyCustomerName: shopifyCustomer
          ? `${shopifyCustomer.firstName || ""} ${shopifyCustomer.lastName || ""}`.trim()
          : shopifyCustomerName,
        syncStatus: shopifyCustomer ? SyncStatus.PENDING : SyncStatus.UNMAPPED,
      },
    });

    // Create sync log
    await prisma.syncLog.create({
      data: {
        storeId,
        mappingId: mapping.id,
        action: "MANUAL_MAPPING",
        status: mapping.syncStatus,
        message: "Mapping created",
      },
    });

    return NextResponse.json({
      success: true,
      data: mapping,
    });
  } catch (error: any) {
    console.error("Error creating mapping:", error);
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
 * DELETE /api/sync/mapping?id=xxx
 * Delete a customer mapping
 */
export async function DELETE(request: NextRequest) {
  try {
    const { storeId } = await getStoreContextOrDefault(request);
    const searchParams = request.nextUrl.searchParams;
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

    await prisma.customerMapping.deleteMany({
      where: { id, storeId },
    });

    return NextResponse.json({
      success: true,
      message: "Mapping deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting mapping:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete mapping",
      },
      { status: 500 }
    );
  }
}
