// API Route: Auto Sync All SYNCED Mappings
// This endpoint can be called by Vercel Cron Jobs or external schedulers
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync/auto-sync
 * Sync all SYNCED mappings
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined; // No limit by default

    console.log('Starting global auto sync...');

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
      failed: 0,
      errors: [] as Array<{ mappingId: string; customerName: string; error: string }>,
    };

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
              body: JSON.stringify({ mappingId: mapping.id }),
            }
          );

          const result = await response.json();

          if (result.success) {
            console.log(`  ✓ Synced: ${mapping.nhanhCustomerName}`);
            return { success: true, mapping };
          } else {
            console.error(`  ✗ Failed: ${mapping.nhanhCustomerName}:`, result.error);
            return {
              success: false,
              mapping,
              error: result.error || 'Unknown error',
            };
          }
        } catch (error: any) {
          console.error(`  ✗ Error: ${mapping.nhanhCustomerName}:`, error.message);
          return {
            success: false,
            mapping,
            error: error.message || 'Unknown error',
          };
        }
      });

      // Wait for all in batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Aggregate results
      batchResults.forEach((result) => {
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({
            mappingId: result.mapping.id,
            customerName: result.mapping.nhanhCustomerName,
            error: result.error || 'Unknown error',
          });
        }
      });
      
      console.log(`Batch ${batchNumber}/${totalBatches} completed: ${batchResults.filter(r => r.success).length} successful, ${batchResults.filter(r => !r.success).length} failed`);

      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < mappings.length) {
        console.log(`Waiting ${BATCH_DELAY}ms before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }

    console.log('Global auto sync completed:', results);

    return NextResponse.json({
      success: true,
      message: 'Global auto sync completed',
      results,
    });
  } catch (error: any) {
    console.error('Error in global auto sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run global auto sync',
      },
      { status: 500 }
    );
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
