// API Route: Sync Product from Nhanh to Shopify
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { shopifyProductAPI } from "@/lib/shopify-product-api";
import { nhanhProductAPI } from "@/lib/nhanh-product-api";

const prisma = new PrismaClient();

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
      // Get latest inventory data from Nhanh
      const nhanhProduct = await nhanhProductAPI.getProductById(mapping.nhanhProductId);

      // Sync ONLY inventory to Shopify (not price)
      await shopifyProductAPI.updateVariantInventory(
        mapping.shopifyVariantId,
        nhanhProduct.quantity
      );

      // Update mapping status to SYNCED
      const updatedMapping = await prisma.productMapping.update({
        where: { id: mappingId },
        data: {
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
          syncError: null,
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
            quantity: nhanhProduct.quantity,
            previousQuantity: mapping.nhanhPrice, // Store for reference
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
