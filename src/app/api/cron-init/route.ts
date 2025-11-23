import { NextResponse } from "next/server";

// This route is called automatically by instrumentation.ts on server start
export async function GET() {
  return NextResponse.json({ 
    message: "Cron initialization endpoint - called by instrumentation.ts" 
  });
}
