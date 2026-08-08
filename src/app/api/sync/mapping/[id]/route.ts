import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";
import { getStoreContextOrDefault } from "@/lib/store-context";
import { findShopifyCustomerMappingConflicts } from "@/lib/shopify-customer-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync/mapping/[id]
 * Get a specific mapping
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { storeId } = await getStoreContextOrDefault(request);
    const { id } = await params;
    const mapping = await prisma.customerMapping.findFirst({
      where: { id, storeId },
      include: {
        syncLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!mapping) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mapping,
    });
  } catch (error: any) {
    console.error("Error fetching mapping:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch mapping",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sync/mapping/[id]
 * Update a mapping
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { storeId } = await getStoreContextOrDefault(request);
    const { id } = await params;
    const body = await request.json();
    const {
      shopifyCustomerId,
      shopifyCustomerEmail,
      shopifyCustomerName,
      syncStatus,
    } = body;

    const existing = await prisma.customerMapping.findFirst({
      where: { id, storeId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Mapping not found" },
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
        { success: false, error: "Shopify customer was not found in the active store" },
        { status: 404 }
      );
    }


    if (shopifyCustomer) {
      const conflicts = await findShopifyCustomerMappingConflicts(
        storeId,
        shopifyCustomer.shopifyId,
        existing.id
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

    const mapping = await prisma.customerMapping.update({
      where: { id: existing.id },
      data: {
        shopifyCustomerId: shopifyCustomerId === undefined
          ? undefined
          : shopifyCustomer?.shopifyId || null,
        shopifyCustomerEmail: shopifyCustomerId === undefined
          ? shopifyCustomerEmail
          : shopifyCustomer?.email || shopifyCustomerEmail,
        shopifyCustomerName: shopifyCustomerId === undefined
          ? shopifyCustomerName
          : shopifyCustomer
            ? `${shopifyCustomer.firstName || ""} ${shopifyCustomer.lastName || ""}`.trim()
            : shopifyCustomerName,
        syncStatus: syncStatus || (shopifyCustomerId === undefined
          ? undefined
          : shopifyCustomer
            ? SyncStatus.PENDING
            : SyncStatus.UNMAPPED),
      },
    });

    // Create sync log
    await prisma.syncLog.create({
      data: {
        storeId,
        mappingId: mapping.id,
        action: "MANUAL_MAPPING",
        status: mapping.syncStatus,
        message: "Mapping updated",
      },
    });

    return NextResponse.json({
      success: true,
      data: mapping,
    });
  } catch (error: any) {
    console.error("Error updating mapping:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update mapping",
      },
      { status: 500 }
    );
  }
}
