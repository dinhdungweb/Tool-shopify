// API Route: Auto Sync All SYNCED Product Mappings
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync/products/auto-sync
 * Sync all SYNCED product mappings
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;

    console.log('Starting product auto sync...');

    // Find all SYNCED product mappings
    const mappings = await prisma.productMapping.findMany({
      where: {
        syncStatus: 'SYNCED',
      },
      ...(limit ? { take: limit } : {}),
      orderBy: { lastSyncedAt: 'asc' }, // Sync oldest first
    });

    console.log(`Found ${mappings.length} SYNCED product mappings to sync`);

    const results = {
      total: mappings.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ mappingId: string; productName: string; error: string }>,
    };

    // Sync mappings in parallel batches for better performance
    // Conservative settings to avoid rate limiting from Nhanh/Shopify APIs
    const BATCH_SIZE = 5; // Process 5 products at a time (safe for rate limits)
    const BATCH_DELAY = 2000; // 2 second delay between batches (safe buffer)
    
    // Rate limit safety:
    // - Nhanh API: ~40 requests/minute limit
    // - Shopify API: 2 requests/second per store
    // - With BATCH_SIZE=5 and BATCH_DELAY=2s: ~150 requests/minute (safe)
    // - Each product = 1 Nhanh call + 1 Shopify call = 2 API calls
    // - 5 products/batch × 2 calls = 10 API calls per batch
    // - With 2s delay: 30 batches/minute = 150 products/minute (safe)
    
    for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
      const batch = mappings.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(mappings.length / BATCH_SIZE);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)...`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (mapping) => {
        try {
          console.log(`  Syncing: ${mapping.nhanhProductName}`);

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/products/sync-product`,
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
            console.log(`  ✓ Synced: ${mapping.nhanhProductName}`);
            return { success: true, mapping };
          } else {
            console.error(`  ✗ Failed: ${mapping.nhanhProductName}:`, result.error);
            return {
              success: false,
              mapping,
              error: result.error || 'Unknown error',
            };
          }
        } catch (error: any) {
          console.error(`  ✗ Error: ${mapping.nhanhProductName}:`, error.message);
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
            productName: result.mapping.nhanhProductName,
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

    console.log('Product auto sync completed:', results);

    return NextResponse.json({
      success: true,
      message: 'Product auto sync completed',
      results,
    });
  } catch (error: any) {
    console.error('Error in product auto sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run product auto sync',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/products/auto-sync
 * Get status of SYNCED product mappings and config
 */
export async function GET() {
  try {
    // Get config
    const config = await prisma.syncSchedule.findUnique({
      where: { id: 'product_auto_sync' },
    });

    // Count SYNCED mappings
    const syncedCount = await prisma.productMapping.count({
      where: {
        syncStatus: 'SYNCED',
      },
    });

    // Get recent syncs
    const recentMappings = await prisma.productMapping.findMany({
      where: {
        syncStatus: 'SYNCED',
      },
      select: {
        id: true,
        nhanhProductName: true,
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
    console.error('Error getting product auto sync status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get product auto sync status',
      },
      { status: 500 }
    );
  }
}
