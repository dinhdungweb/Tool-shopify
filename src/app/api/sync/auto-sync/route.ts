// API Route: Auto Sync All SYNCED Mappings
// This endpoint can be called by Vercel Cron Jobs or external schedulers
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync/auto-sync
 * Sync all SYNCED mappings
 * 
 * Query params:
 * - limit: Maximum number of customers to sync (optional)
 * - forceSync: If "true", skip smart detection and sync all (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const forceSyncParam = searchParams.get('forceSync');
    const limit = limitParam ? parseInt(limitParam) : undefined;
    const forceSync = forceSyncParam === 'true';

    // Check if auto-sync is enabled globally
    // We skip this check if forceSync=true (manual override)
    if (!forceSync) {
      const config = await prisma.autoSyncConfig.findUnique({
        where: { id: 'global' },
      });

      if (!config || !config.enabled) {
        console.log('Auto sync is disabled in settings. Skipping job.');
        return NextResponse.json({
          success: false,
          message: 'Auto sync is disabled globally. Enable it in Settings > Auto Sync.',
          skipped: true,
        });
      }
    }

    // Create background job for tracking
    const job = await prisma.backgroundJob.create({
      data: {
        type: 'AUTO_SYNC_CUSTOMERS',
        total: 0,
        status: 'RUNNING',
        metadata: {
          limit: limit || 'all',
          forceSync,
        },
      },
    });

    console.log(`Starting global auto sync (Job: ${job.id}, forceSync: ${forceSync})...`);

    // Start background processing (don't await)
    autoSyncInBackground(job.id, limit, forceSync);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      forceSync,
      message: forceSync
        ? 'Background FORCE sync started! Check Job Tracking for progress.'
        : 'Background auto sync started! Check Job Tracking for progress.',
    });
  } catch (error: any) {
    console.error('Error starting auto sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to start auto sync',
      },
      { status: 500 }
    );
  }
}

async function autoSyncInBackground(jobId: string, limit?: number, forceSync: boolean = false) {
  try {
    console.log(`Starting global auto sync (forceSync: ${forceSync})...`);

    // Find all SYNCED mappings
    const mappings = await prisma.customerMapping.findMany({
      where: {
        syncStatus: 'SYNCED',
      },
      ...(limit ? { take: limit } : {}), // Only apply limit if specified
      orderBy: { lastSyncedAt: 'asc' }, // Sync oldest first
    });

    console.log(`Found ${mappings.length} SYNCED mappings to sync`);

    const results = {
      total: mappings.length,
      successful: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ mappingId: string; customerName: string; error: string }>,
    };

    // Update job with total count
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        total: mappings.length,
      },
    }).catch(() => { });

    // Sync mappings in parallel batches for better performance
    // Conservative settings to avoid rate limiting from Nhanh/Shopify APIs
    const BATCH_SIZE = 5; // Process 5 customers at a time (safe for rate limits)
    const BATCH_DELAY = 2000; // 2 second delay between batches (safe buffer)

    // Rate limit safety:
    // - Nhanh API: ~40 requests/minute limit
    // - Shopify API: 2 requests/second per store
    // - With BATCH_SIZE=5 and BATCH_DELAY=2s: ~150 requests/minute (safe)
    // - Each customer = 1 Nhanh call + 1 Shopify call = 2 API calls
    // - 5 customers/batch × 2 calls = 10 API calls per batch
    // - With 2s delay: 30 batches/minute = 150 customers/minute (safe)

    for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
      const batch = mappings.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(mappings.length / BATCH_SIZE);

      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} customers)...`);

      // Process batch in parallel
      const batchPromises = batch.map(async (mapping) => {
        try {
          console.log(`  Syncing: ${mapping.nhanhCustomerName}`);

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/sync-customer`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ mappingId: mapping.id, forceSync }),
            }
          );

          const result = await response.json();

          if (result.success) {
            if (result.skipped) {
              console.log(`  ⏭️ Skipped: ${mapping.nhanhCustomerName} (no change)`);
              return { success: true, skipped: true, mapping };
            }
            console.log(`  ✓ Synced: ${mapping.nhanhCustomerName}`);
            return { success: true, skipped: false, mapping };
          } else {
            console.error(`  ✗ Failed: ${mapping.nhanhCustomerName}:`, result.error);
            return {
              success: false,
              skipped: false,
              mapping,
              error: result.error || 'Unknown error',
            };
          }
        } catch (error: any) {
          console.error(`  ✗ Error: ${mapping.nhanhCustomerName}:`, error.message);
          return {
            success: false,
            skipped: false,
            mapping,
            error: error.message || 'Unknown error',
          };
        }
      });

      // Wait for all in batch to complete
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
          results.errors.push({
            mappingId: result.mapping.id,
            customerName: result.mapping.nhanhCustomerName,
            error: result.error || 'Unknown error',
          });
        }
      });

      const batchSynced = batchResults.filter((r: any) => r.success && !r.skipped).length;
      const batchSkipped = batchResults.filter((r: any) => r.skipped).length;
      const batchFailed = batchResults.filter((r: any) => !r.success).length;
      console.log(`Batch ${batchNumber}/${totalBatches} completed: ${batchSynced} synced, ${batchSkipped} skipped, ${batchFailed} failed`);

      // Update job progress
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          processed: i + batch.length,
          successful: results.successful,
          failed: results.failed,
          metadata: {
            limit: limit || 'all',
            forceSync,
            skipped: results.skipped,
            currentBatch: batchNumber,
            totalBatches,
          },
        },
      }).catch(() => { });

      // OPTIMIZED: Reduce delay when batch is all skipped (no Shopify API calls)
      if (i + BATCH_SIZE < mappings.length) {
        const allSkipped = batchSynced === 0 && batchFailed === 0;
        const actualDelay = allSkipped ? 200 : BATCH_DELAY; // 200ms if all skipped, full delay otherwise
        console.log(`Waiting ${actualDelay}ms before next batch...${allSkipped ? ' (fast - all skipped)' : ''}`);
        await new Promise((resolve) => setTimeout(resolve, actualDelay));
      }
    }

    console.log('Global auto sync completed:', results);

    // Mark job as completed
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        processed: mappings.length,
        successful: results.successful,
        failed: results.failed,
        completedAt: new Date(),
        metadata: {
          limit: limit || 'all',
          forceSync,
          results,
        },
      },
    }).catch(() => { });
  } catch (error: any) {
    console.error('Error in global auto sync:', error);

    // Mark job as failed
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: error.message,
        completedAt: new Date(),
      },
    }).catch(() => { });
  }
}

/**
 * GET /api/sync/auto-sync
 * Get status of SYNCED mappings and global config
 */
export async function GET() {
  try {
    // Get global config
    const config = await prisma.autoSyncConfig.findUnique({
      where: { id: 'global' },
    });

    // Count SYNCED mappings
    const syncedCount = await prisma.customerMapping.count({
      where: {
        syncStatus: 'SYNCED',
      },
    });

    // Get recent syncs
    const recentMappings = await prisma.customerMapping.findMany({
      where: {
        syncStatus: 'SYNCED',
      },
      select: {
        id: true,
        nhanhCustomerName: true,
        lastSyncedAt: true,
        syncStatus: true,
      },
      orderBy: { lastSyncedAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        config: config || { enabled: false, schedule: '0 */6 * * *' },
        syncedMappingsCount: syncedCount,
        recentMappings,
      },
    });
  } catch (error: any) {
    console.error('Error getting auto sync status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get auto sync status',
      },
      { status: 500 }
    );
  }
}
