// API Route: Redirect to global schedule
// This file is kept for backward compatibility
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Please use /api/sync/schedule/global for global configuration',
    redirect: '/api/sync/schedule/global',
  });
}

export async function POST() {
  return NextResponse.json({
    message: 'Please use /api/sync/schedule/global for global configuration',
    redirect: '/api/sync/schedule/global',
  });
}

export async function DELETE() {
  return NextResponse.json({
    message: 'Please use /api/sync/schedule/global for global configuration',
    redirect: '/api/sync/schedule/global',
  });
}
