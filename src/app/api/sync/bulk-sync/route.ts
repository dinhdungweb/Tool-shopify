import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";
import { nhanhAPI } from "@/lib/nhanh-api";
import { SyncStatus, SyncAction } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for bulk operations

/**
 * POST /api/sync/bulk-sync
 * Sync multiple customers at once
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappingIds } = body;

    if (!mappingIds || !Array.isArray(mappingIds) || mappingIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "mappingIds array is required",
        },
        { status: 400 }
      );
    }

    const results = {
      total: mappingIds.length,
      successful: 0,
      failed: 0,
      details: [] as any[],
    };

    // Process each mapping
    for (const mappingId of mappingIds) {
      try {
        const mapping = await prisma.customerMapping.findUnique({
          where: { id: mappingId },
        });

        if (!mapping || !mapping.shopifyCustomerId) {
          results.failed++;
          results.details.push({
            mappingId,
            success: false,
            error: "Mapping not found or no Shopify customer",
          });
          continue;
        }

        // Get latest total spent from Nhanh
        const totalSpent = await nhanhAPI.getCustomerTotalSpent(
          mapping.nhanhCustomerId
        );

        // Update Shopify metafield
        await shopifyAPI.syncCustomerTotalSpent(
          mapping.shopifyCustomerId,
          totalSpent
        );

        // Update mapping
        await prisma.customerMapping.update({
          where: { id: mappingId },
          data: {
            nhanhTotalSpent: totalSpent,
            syncStatus: SyncStatus.SYNCED,
            lastSyncedAt: new Date(),
            syncError: null,
            syncAttempts: { increment: 1 },
          },
        });

        // Create sync log
        await prisma.syncLog.create({
          data: {
            mappingId: mapping.id,
            action: SyncAction.BULK_SYNC,
            status: SyncStatus.SYNCED,
            message: `Bulk synced total spent: ${totalSpent}`,
            metadata: {
              totalSpent,
              shopifyCustomerId: mapping.shopifyCustomerId,
            },
          },
        });

        results.successful++;
        results.details.push({
          mappingId,
          success: true,
          totalSpent,
        });
      } catch (error: any) {
        console.error(`Error syncing mapping ${mappingId}:`, error);

        // Update mapping with error
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
            mappingId,
            action: SyncAction.BULK_SYNC,
            status: SyncStatus.FAILED,
            message: "Bulk sync failed",
            errorDetail: error.message,
          },
        });

        results.failed++;
        results.details.push({
          mappingId,
          success: false,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `Bulk sync completed: ${results.successful} successful, ${results.failed} failed`,
    });
  } catch (error: any) {
    console.error("Error in bulk sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to perform bulk sync",
      },
      { status: 500 }
    );
  }
}
