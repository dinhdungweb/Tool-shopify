// API Route: Sync Product from Nhanh to Shopify
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyProductAPI } from "@/lib/shopify-product-api";
import { nhanhProductAPI } from "@/lib/nhanh-product-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappingId } = body;

    if (!mappingId) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping ID is required",
        },
        { status: 400 }
      );
    }

    // Get mapping
    const mapping = await prisma.productMapping.findUnique({
      where: { id: mappingId },
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

    if (!mapping.shopifyProductId || !mapping.shopifyVariantId) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopify product not mapped",
        },
        { status: 400 }
      );
    }

    // Update mapping status to PENDING
    await prisma.productMapping.update({
      where: { id: mappingId },
      data: {
        syncStatus: "PENDING",
        syncAttempts: { increment: 1 },
      },
    });

    try {
      // Get real-time inventory data from Nhanh API
      // Using /v3.0/product/inventory endpoint with filter: ids
      console.log(`Fetching inventory for product ${mapping.nhanhProductId} from Nhanh API...`);
      
      const inventoryData = await nhanhProductAPI.getProductInventory(mapping.nhanhProductId);
      
      console.log(`Product ${mapping.nhanhProductName}: quantity = ${inventoryData.quantity}`);

      // Sync ONLY inventory to Shopify (not price)
      const result = await shopifyProductAPI.updateVariantInventory(
        mapping.shopifyVariantId,
        inventoryData.quantity,
        mapping.shopifyInventoryItemId || undefined
      );

      // Update mapping status to SYNCED and cache inventoryItemId
      const updatedMapping = await prisma.productMapping.update({
        where: { id: mappingId },
        data: {
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
          syncError: null,
          shopifyInventoryItemId: result.inventoryItemId,
        },
      });

      // Create sync log
      await prisma.productSyncLog.create({
        data: {
          mappingId,
          action: "MANUAL_SYNC",
          status: "SYNCED",
          message: "Inventory synced successfully",
          metadata: {
            quantity: inventoryData.quantity,
            price: inventoryData.price,
            syncedAt: new Date().toISOString(),
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Inventory synced successfully",
        data: {
          ...updatedMapping,
          nhanhPrice: parseFloat(updatedMapping.nhanhPrice.toString()),
        },
      });
    } catch (syncError: any) {
      console.error("Error syncing product:", syncError);

      // Update mapping status to FAILED
      await prisma.productMapping.update({
        where: { id: mappingId },
        data: {
          syncStatus: "FAILED",
          syncError: syncError.message,
        },
      });

      // Create sync log
      await prisma.productSyncLog.create({
        data: {
          mappingId,
          action: "MANUAL_SYNC",
          status: "FAILED",
          message: "Product sync failed",
          errorDetail: syncError.message,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: syncError.message || "Failed to sync product",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in sync product:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sync product",
      },
      { status: 500 }
    );
  }
}
