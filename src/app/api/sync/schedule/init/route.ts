// API Route: Initialize Cron Scheduler
import { NextResponse } from 'next/server';
import { cronScheduler } from '@/lib/cron-scheduler';

// GET: Initialize the cron scheduler
export async function GET() {
  try {
    await cronScheduler.initialize();

    const status = cronScheduler.getStatus();

    return NextResponse.json({
      success: true,
      message: 'Cron scheduler initialized successfully',
      status,
    });
  } catch (error) {
    console.error('Error initializing cron scheduler:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize cron scheduler',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST: Reinitialize the cron scheduler (reload all schedules)
export async function POST() {
  try {
    // Stop all existing tasks
    cronScheduler.stopAll();

    // Reinitialize
    await cronScheduler.initialize();

    const status = cronScheduler.getStatus();

    return NextResponse.json({
      success: true,
      message: 'Cron scheduler reinitialized successfully',
      status,
    });
  } catch (error) {
    console.error('Error reinitializing cron scheduler:', error);
    return NextResponse.json(
      { 
        error: 'Failed to reinitialize cron scheduler',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
