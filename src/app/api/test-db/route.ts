// Test Database tables
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Try to query sale campaigns table
    const campaigns = await prisma.saleCampaign.findMany({
      take: 5,
    });
    
    // Try to query price changes table
    const priceChanges = await prisma.priceChange.findMany({
      take: 5,
    });
    
    return NextResponse.json({
      success: true,
      data: {
        campaignsCount: campaigns.length,
        priceChangesCount: priceChanges.length,
        campaigns,
        priceChanges,
      },
    });
  } catch (error: any) {
    console.error("Database test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }
}
