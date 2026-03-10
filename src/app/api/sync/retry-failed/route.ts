import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";
import { SyncStatus, SyncAction } from "@prisma/client";
import { shopifyQueue, QueuePriority } from "@/lib/shopify-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/sync/retry-failed
 * Retry failed syncs (useful after rate limit errors)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { limit = 100 } = body;

    // Get failed mappings
    const failedMappings = await prisma.customerMapping.findMany({
      where: {
        syncStatus: SyncStatus.FAILED,
        shopifyCustomerId: { not: null },
      },
      take: limit,
      orderBy: { updatedAt: "asc" }, // Retry oldest first
    });

    if (failedMappings.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          message: "No failed syncs to retry",
        },
      });
    }

    // Start background retry (don't await)
    retryFailedBackground(failedMappings.map((m) => m.id));

    return NextResponse.json({
      success: true,
      data: {
        total: failedMappings.length,
        message: `Retrying ${failedMappings.length} failed syncs in background. Check server logs for progress.`,
      },
    });
  } catch (error: any) {
    console.error("Error starting retry:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function retryFailedBackground(mappingIds: string[]) {
  console.log(`🔄 Retrying ${mappingIds.length} failed syncs...`);
  const startTime = Date.now();

  let successful = 0;
  let failed = 0;

  // Balanced settings - avoid Shopify rate limits
  const batchSize = 5; // Process 5 customers at a time (Shopify has rate limits too)
  const batchDelay = 1000; // 1 second between batches
  const totalBatches = Math.ceil(mappingIds.length / batchSize);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, mappingIds.length);
    const batchIds = mappingIds.slice(start, end);

    console.log(
      `📦 Retry batch ${batchIndex + 1}/${totalBatches} (${successful + failed}/${mappingIds.length} completed)...`
    );

    const batchPromises = batchIds.map(async (mappingId, index) => {
      try {
        const mapping = await prisma.customerMapping.findUnique({
          where: { id: mappingId },
          include: {
            nhanhCustomer: true, // Include customer data from database
          },
        });

        if (!mapping || !mapping.shopifyCustomerId || !mapping.nhanhCustomer) {
          failed++;
          return;
        }

        // Use totalSpent from database instead of calling API — qua queue
        const totalSpent = Number(mapping.nhanhCustomer.totalSpent);
        await shopifyQueue.enqueue({
          type: "graphql",
          priority: QueuePriority.BULK,
          entityId: `customer_${mapping.id}`,
          action: "sync_customer_total_spent",
          source: "retry_failed",
          execute: () => shopifyAPI.syncCustomerTotalSpent(
            mapping.shopifyCustomerId!,
            totalSpent
          ),
        });

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

        await prisma.syncLog.create({
          data: {
            mappingId: mapping.id,
            action: SyncAction.BULK_SYNC, // Use BULK_SYNC for retry (RETRY enum not yet in types)
            status: SyncStatus.SYNCED,
            message: `Retry successful: ${totalSpent}`,
            metadata: {
              totalSpent,
              shopifyCustomerId: mapping.shopifyCustomerId,
              isRetry: true,
            },
          },
        });

        successful++;
      } catch (error: any) {
        failed++;
        const errorMessage = error.message || "Unknown error";

        if (
          errorMessage.includes("Rate Limit") ||
          errorMessage.includes("429")
        ) {
          console.warn(
            `⚠️ Rate limit still hit for customer ${mappingId}, will need another retry`
          );
        }

        try {
          await prisma.customerMapping.update({
            where: { id: mappingId },
            data: {
              syncStatus: SyncStatus.FAILED,
              syncError: errorMessage.substring(0, 500),
              syncAttempts: { increment: 1 },
            },
          });
        } catch (e) {
          // Ignore
        }
      }
    });

    await Promise.all(batchPromises);

    // Wait between batches
    if (batchIndex < totalBatches - 1) {
      await new Promise((resolve) => setTimeout(resolve, batchDelay));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`🎉 Retry completed in ${duration}s!`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Still failed: ${failed}`);
}
