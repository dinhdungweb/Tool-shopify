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

    console.log(`🚀 Starting bulk sync for ${mappingIds.length} customers...`);
    const startTime = Date.now();

    const results = {
      total: mappingIds.length,
      successful: 0,
      skipped: 0,
      failed: 0,
      details: [] as any[],
    };

    // Process in batches to respect API rate limits
    // Shopify: 2 requests/second (REST), 50 points/second (GraphQL)
    // Nhanh: Unknown, but be conservative
    const batchSize = 5; // Process 5 customers in parallel (safer for rate limits)
    const batchDelay = 1000; // 1 second delay between batches
    const totalBatches = Math.ceil(mappingIds.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, mappingIds.length);
      const batchIds = mappingIds.slice(start, end);

      console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batchIds.length} customers)...`);

      // Process batch in parallel
      const batchPromises = batchIds.map(async (mappingId) => {
        try {
          const mapping = await prisma.customerMapping.findUnique({
            where: { id: mappingId },
          });

          if (!mapping || !mapping.shopifyCustomerId) {
            return {
              mappingId,
              success: false,
              error: "Mapping not found or no Shopify customer",
            };
          }

          // Get latest total spent from Nhanh
          const totalSpent = await nhanhAPI.getCustomerTotalSpent(
            mapping.nhanhCustomerId
          );

          // SMART CHANGE DETECTION: Compare with current value - skip if no significant change
          const currentTotalSpent = Number(mapping.nhanhTotalSpent);
          const newTotalSpent = Number(totalSpent);
          const hasChanged = Math.abs(newTotalSpent - currentTotalSpent) >= 1000; // Threshold 1000đ

          if (!hasChanged) {
            // No significant change, skip Shopify API call but still mark as synced
            await prisma.customerMapping.update({
              where: { id: mappingId },
              data: {
                syncStatus: SyncStatus.SYNCED,
                lastSyncedAt: new Date(),
                syncError: null,
              },
            });

            console.log(`⏭️ Skipped ${mappingId}: totalSpent unchanged (${currentTotalSpent})`);

            return {
              mappingId,
              success: true,
              skipped: true,
              reason: `No change in totalSpent (${currentTotalSpent})`,
            };
          }

          // Update Shopify metafield (only when changed)
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
              message: `Bulk synced total spent: ${currentTotalSpent} → ${totalSpent}`,
              metadata: {
                previousTotalSpent: currentTotalSpent,
                totalSpent,
                shopifyCustomerId: mapping.shopifyCustomerId,
              },
            },
          });

          return {
            mappingId,
            success: true,
            totalSpent,
            previousTotalSpent: currentTotalSpent,
          };
        } catch (error: any) {
          console.error(`Error syncing mapping ${mappingId}:`, error);

          // Update mapping with error
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
                mappingId,
                action: SyncAction.BULK_SYNC,
                status: SyncStatus.FAILED,
                message: "Bulk sync failed",
                errorDetail: error.message,
              },
            });
          } catch (logError) {
            console.error("Error logging sync failure:", logError);
          }

          return {
            mappingId,
            success: false,
            error: error.message,
          };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Aggregate results
      batchResults.forEach((result: any) => {
        if (result.success) {
          if (result.skipped) {
            results.skipped++;
          } else {
            results.successful++;
          }
        } else {
          results.failed++;
        }
        results.details.push(result);
      });

      console.log(`  ✅ Batch ${batchIndex + 1} completed: ${results.successful} synced, ${results.skipped} skipped, ${results.failed} failed`);

      // Add delay between batches to respect rate limits
      if (batchIndex < totalBatches - 1) {
        console.log(`  ⏳ Waiting ${batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const speed = (results.total / parseFloat(duration)).toFixed(1);
    console.log(`🎉 Bulk sync completed in ${duration}s (${speed} customers/sec)!`);

    return NextResponse.json({
      success: true,
      data: results,
      message: `Bulk sync completed: ${results.successful} synced, ${results.skipped} skipped (unchanged), ${results.failed} failed`,
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
