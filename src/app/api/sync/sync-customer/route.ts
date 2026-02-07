import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";
import { nhanhAPI } from "@/lib/nhanh-api";
import { SyncStatus, SyncAction } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync/sync-customer
 * Sync a single customer's total spent to Shopify
 * 
 * Params:
 * - mappingId: ID of the customer mapping (required)
 * - forceSync: If true, skip smart detection and always sync (optional)
 */
export async function POST(request: NextRequest) {
  let mappingId: string | undefined;

  try {
    const body = await request.json();
    console.log("🔍 Sync Customer Body:", JSON.stringify(body)); // Debug log
    mappingId = body.mappingId;
    const forceSync = body.forceSync === true;
    console.log(`⚡ Sync params: mappingId=${mappingId}, forceSync=${forceSync} (raw=${body.forceSync})`); // Debug log

    if (!mappingId) {
      return NextResponse.json(
        {
          success: false,
          error: "mappingId is required",
        },
        { status: 400 }
      );
    }

    // Get mapping
    const mapping = await prisma.customerMapping.findUnique({
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

    if (!mapping.shopifyCustomerId) {
      return NextResponse.json(
        {
          success: false,
          error: "No Shopify customer mapped",
        },
        { status: 400 }
      );
    }

    // Get latest total spent from Nhanh
    const totalSpent = await nhanhAPI.getCustomerTotalSpent(
      mapping.nhanhCustomerId
    );

    // SMART DETECTION: Compare with last synced value
    const currentTotalSpent = Number(mapping.nhanhTotalSpent);
    const newTotalSpent = Number(totalSpent);
    const hasChanged = Math.abs(newTotalSpent - currentTotalSpent) >= 1000 || !mapping.lastSyncedAt; // Threshold 1000đ

    // Skip if no significant change (unless forceSync)
    if (!hasChanged && !forceSync) {
      // Update lastSyncedAt but skip Shopify API call
      await prisma.customerMapping.update({
        where: { id: mappingId },
        data: {
          syncStatus: SyncStatus.SYNCED,
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });

      console.log(`⏭️ Skipped sync for ${mapping.nhanhCustomerName}: totalSpent unchanged (${currentTotalSpent})`);

      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `No change in totalSpent (${currentTotalSpent})`,
        message: "Customer already synced (no change)",
      });
    }

    // Update Shopify metafield (only when changed or forceSync)
    await shopifyAPI.syncCustomerTotalSpent(
      mapping.shopifyCustomerId,
      totalSpent
    );

    // Update mapping AND NhanhCustomer (to keep DB fresh for bulk syncs)
    const [updatedMapping] = await prisma.$transaction([
      prisma.customerMapping.update({
        where: { id: mappingId },
        data: {
          nhanhTotalSpent: totalSpent,
          syncStatus: SyncStatus.SYNCED,
          lastSyncedAt: new Date(),
          syncError: null,
          syncAttempts: { increment: 1 },
        },
      }),
      prisma.nhanhCustomer.update({
        where: { id: mapping.nhanhCustomerId },
        data: {
          totalSpent: totalSpent,
          lastPulledAt: new Date(), // Mark as recently updated
        },
      }),
    ]);

    // Create sync log
    await prisma.syncLog.create({
      data: {
        mappingId: mapping.id,
        action: SyncAction.MANUAL_SYNC,
        status: SyncStatus.SYNCED,
        message: forceSync
          ? `Force synced total spent: ${currentTotalSpent} → ${totalSpent}`
          : `Synced total spent: ${currentTotalSpent} → ${totalSpent}`,
        metadata: {
          previousTotalSpent: currentTotalSpent,
          totalSpent,
          shopifyCustomerId: mapping.shopifyCustomerId,
          forceSync,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedMapping,
      previousTotalSpent: currentTotalSpent,
      message: "Customer synced successfully",
    });
  } catch (error: any) {
    console.error("Error syncing customer:", error);

    // Update mapping with error
    if (mappingId) {
      try {
        await prisma.customerMapping.update({
          where: { id: mappingId },
          data: {
            syncStatus: SyncStatus.FAILED,
            syncError: error.message,
            syncAttempts: { increment: 1 },
          },
        });

        // Create error log
        await prisma.syncLog.create({
          data: {
            mappingId: mappingId,
            action: SyncAction.MANUAL_SYNC,
            status: SyncStatus.FAILED,
            message: "Sync failed",
            errorDetail: error.message,
          },
        });
      } catch (logError) {
        console.error("Error logging sync failure:", logError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sync customer",
      },
      { status: 500 }
    );
  }
}
