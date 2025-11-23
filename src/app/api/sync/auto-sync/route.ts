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

    // Sync each mapping
    for (const mapping of mappings) {
      try {
        console.log(`Auto syncing: ${mapping.nhanhCustomerName} (${mapping.id})`);

        // Call the sync API internally
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
          results.successful++;
          console.log(`✓ Synced: ${mapping.nhanhCustomerName}`);
        } else {
          results.failed++;
          results.errors.push({
            mappingId: mapping.id,
            customerName: mapping.nhanhCustomerName,
            error: result.error || 'Unknown error',
          });
          console.error(`✗ Failed: ${mapping.nhanhCustomerName}:`, result.error);
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          mappingId: mapping.id,
          customerName: mapping.nhanhCustomerName,
          error: error.message || 'Unknown error',
        });
        console.error(`✗ Error syncing ${mapping.nhanhCustomerName}:`, error);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
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
