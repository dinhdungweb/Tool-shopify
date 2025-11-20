// API Route: Global Auto Sync Configuration
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateCronExpression } from '@/lib/cron-scheduler';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/schedule/global
 * Get global auto sync configuration
 */
export async function GET() {
  try {
    let config = await prisma.autoSyncConfig.findUnique({
      where: { id: 'global' },
    });

    // Create default config if not exists
    if (!config) {
      config = await prisma.autoSyncConfig.create({
        data: {
          id: 'global',
          enabled: false,
          schedule: '0 */6 * * *', // Every 6 hours
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    console.error('Error getting global config:', error);
    return NextResponse.json(
      { error: 'Failed to get global configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/schedule/global
 * Update global auto sync configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled, schedule } = body;

    // Validate schedule if provided
    if (schedule && !validateCronExpression(schedule)) {
      return NextResponse.json(
        { error: 'Invalid cron expression' },
        { status: 400 }
      );
    }

    // Update or create config
    const config = await prisma.autoSyncConfig.upsert({
      where: { id: 'global' },
      update: {
        enabled: enabled ?? undefined,
        schedule: schedule ?? undefined,
      },
      create: {
        id: 'global',
        enabled: enabled ?? false,
        schedule: schedule ?? '0 */6 * * *',
      },
    });

    // Reinitialize scheduler with new config
    if (config.enabled) {
      const initResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/schedule/init`,
        { method: 'POST' }
      );
      const initResult = await initResponse.json();
      console.log('Scheduler reinitialized:', initResult);
    }

    return NextResponse.json({
      success: true,
      message: enabled
        ? 'Global auto sync enabled successfully'
        : 'Global auto sync disabled successfully',
      data: config,
    });
  } catch (error: any) {
    console.error('Error updating global config:', error);
    return NextResponse.json(
      { error: 'Failed to update global configuration' },
      { status: 500 }
    );
  }
}
