import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";
import { SyncStatus, SyncAction } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/sync/bulk-sync-background
 * Start background sync for large batches (returns immediately)
 * Optimized for 10k+ customers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappingIds } = body;

    if (!mappingIds || !Array.isArray(mappingIds) || mappingIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "mappingIds array is required" },
        { status: 400 }
      );
    }

    // Create background job for tracking
    const job = await prisma.backgroundJob.create({
      data: {
        type: "CUSTOMER_SYNC",
        total: mappingIds.length,
        status: "RUNNING",
        metadata: {
          estimatedSpeed: "~5 customers/sec",
          estimatedTime: `~${Math.ceil(mappingIds.length / 5 / 60)} minutes`,
        },
      },
    });

    // Start background processing (don't await)
    bulkSyncBackground(mappingIds, job.id);

    return NextResponse.json({
      success: true,
      data: {
        total: mappingIds.length,
        jobId: job.id,
        message: `Background sync started for ${mappingIds.length} customers. Check progress in UI.`,
      },
    });
  } catch (error: any) {
    console.error("Error starting background sync:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function bulkSyncBackground(mappingIds: string[], jobId: string) {
  console.log(`🚀 Starting background bulk sync for ${mappingIds.length} customers (Job: ${jobId})...`);
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

    if (batchIndex % 100 === 0) {
      console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${successful + failed}/${mappingIds.length} completed)...`);
    }

    const batchPromises = batchIds.map(async (mappingId, index) => {
      try {
        // Add small delay between requests in same batch to avoid Shopify throttling
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 200 * index)); // 200ms stagger
        }

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

        // Use totalSpent from database instead of calling API
        const totalSpent = Number(mapping.nhanhCustomer.totalSpent);
        await shopifyAPI.syncCustomerTotalSpent(mapping.shopifyCustomerId, totalSpent);

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
            action: SyncAction.BULK_SYNC,
            status: SyncStatus.SYNCED,
            message: `Background synced: ${totalSpent}`,
            metadata: { totalSpent, shopifyCustomerId: mapping.shopifyCustomerId },
          },
        });

        successful++;
      } catch (error: any) {
        failed++;
        const errorMessage = error.message || "Unknown error";
        
        // Log rate limit errors specifically
        if (errorMessage.includes("Rate Limit") || errorMessage.includes("429")) {
          console.warn(`⚠️ Rate limit hit for customer ${mappingId}, will retry later`);
        }
        
        try {
          await prisma.customerMapping.update({
            where: { id: mappingId },
            data: {
              syncStatus: SyncStatus.FAILED,
              syncError: errorMessage.substring(0, 500), // Limit error message length
              syncAttempts: { increment: 1 },
            },
          });
        } catch (e) {
          // Ignore database errors
        }
      }
    });

    await Promise.all(batchPromises);

    // Update job progress every 10 batches
    if (batchIndex % 10 === 0 || batchIndex === totalBatches - 1) {
      const processed = successful + failed;
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = processed > 0 ? (processed / elapsed).toFixed(1) : "0";
      const remaining = mappingIds.length - processed;
      const eta = processed > 0 ? Math.ceil(remaining / (processed / elapsed)) : 0;
      
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          processed,
          successful,
          failed,
          metadata: {
            speed: `${speed} customers/sec`,
            eta: eta > 60 ? `~${Math.ceil(eta / 60)} min` : `~${eta} sec`,
          },
        },
      }).catch(() => {}); // Ignore errors
    }

    // Shorter delay for background processing
    if (batchIndex < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }

  const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
  const speed = (mappingIds.length / durationSeconds).toFixed(1);
  const durationFormatted = durationSeconds < 60 ? `${durationSeconds}s` : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;
  console.log(`🎉 Background bulk sync completed in ${durationFormatted} (${speed} customers/sec)!`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);

  // Update job as completed
  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      processed: successful + failed,
      successful,
      failed,
      completedAt: new Date(),
      metadata: {
        duration: durationFormatted,
        speed: `${speed} customers/sec`,
      },
    },
  }).catch(() => {}); // Ignore errors
}
