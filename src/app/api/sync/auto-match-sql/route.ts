import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/sync/auto-match-sql
 * Ultra-fast SQL-based auto-match using database queries
 * Perfect for large datasets (200k+ customers)
 */
export async function POST(request: NextRequest) {
  try {
    const { dryRun = false } = await request.json();

    console.log("🚀 Starting SQL-based auto-match (ultra-fast for large datasets)...");
    const startTime = Date.now();

    // Step 1: Create temp table with phone variations
    console.log("📊 Creating phone variations...");
    await prisma.$executeRaw`
      CREATE TEMP TABLE IF NOT EXISTS phone_matches (
        nhanh_id TEXT,
        shopify_id TEXT,
        match_count INT
      );
    `;

    // Step 2: Match by phone - optimized for large datasets
    console.log("🔍 Matching by phone (this may take 30-60 seconds for 200k+ customers)...");
    
    // First, get unmapped customers count
    const unmappedCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count 
      FROM nhanh_customers n
      WHERE n.phone IS NOT NULL 
        AND n.phone != ''
        AND NOT EXISTS (
          SELECT 1 FROM customer_mappings cm WHERE cm."nhanhCustomerId" = n.id
        );
    `;
    console.log(`  Found ${Number(unmappedCount[0].count)} unmapped Nhanh customers with phone`);
    
    // Match with multiple strategies
    await prisma.$executeRaw`
      INSERT INTO phone_matches (nhanh_id, shopify_id, match_count)
      SELECT 
        n.id as nhanh_id,
        s.id as shopify_id,
        1 as match_count
      FROM nhanh_customers n
      INNER JOIN shopify_customers s ON (
        n.phone = s.phone 
        OR n.phone = s."defaultAddressPhone"
        OR ('84' || SUBSTRING(n.phone FROM 2)) = s.phone
        OR ('84' || SUBSTRING(n.phone FROM 2)) = s."defaultAddressPhone"
        OR n.phone = ('0' || SUBSTRING(s.phone FROM 3))
        OR n.phone = ('0' || SUBSTRING(s."defaultAddressPhone" FROM 3))
      )
      WHERE n.phone IS NOT NULL
        AND n.phone != ''
        AND NOT EXISTS (
          SELECT 1 FROM customer_mappings cm WHERE cm."nhanhCustomerId" = n.id
        );
    `;
    
    console.log("  ✅ Phone matching completed");
    
    // Count matches per Nhanh customer
    await prisma.$executeRaw`
      CREATE TEMP TABLE phone_matches_grouped AS
      SELECT nhanh_id, shopify_id, COUNT(*) as match_count
      FROM phone_matches
      GROUP BY nhanh_id, shopify_id;
    `;
    
    await prisma.$executeRaw`DROP TABLE phone_matches;`;
    await prisma.$executeRaw`ALTER TABLE phone_matches_grouped RENAME TO phone_matches;`;

    // Count unique matches (only 1-to-1 matches)
    const stats = await prisma.$queryRaw<Array<{ 
      total: bigint;
      unique_matches: bigint;
      multiple_matches: bigint;
    }>>`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE match_count = 1) as unique_matches,
        COUNT(*) FILTER (WHERE match_count > 1) as multiple_matches
      FROM (
        SELECT nhanh_id, SUM(match_count) as match_count
        FROM phone_matches
        GROUP BY nhanh_id
      ) grouped;
    `;

    const uniqueMatches = Number(stats[0].unique_matches);
    const multipleMatches = Number(stats[0].multiple_matches);
    
    console.log(`✅ Matching results:`);
    console.log(`   - Unique matches (1-to-1): ${uniqueMatches}`);
    console.log(`   - Multiple matches (skipped): ${multipleMatches}`);

    if (dryRun) {
      // Show sample matches
      const samples = await prisma.$queryRaw<Array<{
        nhanh_id: string;
        nhanh_name: string;
        nhanh_phone: string;
        shopify_id: string;
        shopify_name: string;
      }>>`
        SELECT 
          pm.nhanh_id,
          n.name as nhanh_name,
          n.phone as nhanh_phone,
          pm.shopify_id,
          (COALESCE(s."firstName", '') || ' ' || COALESCE(s."lastName", '')) as shopify_name
        FROM phone_matches pm
        INNER JOIN nhanh_customers n ON n.id = pm.nhanh_id
        INNER JOIN shopify_customers s ON s.id = pm.shopify_id
        WHERE pm.nhanh_id IN (
          SELECT nhanh_id 
          FROM phone_matches 
          GROUP BY nhanh_id 
          HAVING SUM(match_count) = 1
        )
        LIMIT 10;
      `;

      await prisma.$executeRaw`DROP TABLE IF EXISTS phone_matches;`;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return NextResponse.json({
        success: true,
        data: {
          total: uniqueMatches,
          matched: uniqueMatches,
          skipped: multipleMatches,
          samples,
          duration: `${duration}s`,
          dryRun: true,
          message: `Dry run: Found ${uniqueMatches} potential matches in ${duration}s`,
        },
      });
    }

    // Step 3: Create mappings for unique matches only (1-to-1)
    console.log("💾 Creating mappings for unique matches...");
    const result = await prisma.$executeRaw`
      INSERT INTO customer_mappings (
        id,
        "createdAt",
        "updatedAt",
        "nhanhCustomerId",
        "nhanhCustomerName",
        "nhanhCustomerPhone",
        "nhanhCustomerEmail",
        "nhanhTotalSpent",
        "shopifyCustomerId",
        "shopifyCustomerEmail",
        "shopifyCustomerName",
        "syncStatus"
      )
      SELECT 
        gen_random_uuid(),
        NOW(),
        NOW(),
        pm.nhanh_id,
        n.name,
        n.phone,
        n.email,
        n."totalSpent",
        pm.shopify_id,
        s.email,
        (COALESCE(s."firstName", '') || ' ' || COALESCE(s."lastName", '')),
        'PENDING'
      FROM phone_matches pm
      INNER JOIN nhanh_customers n ON n.id = pm.nhanh_id
      INNER JOIN shopify_customers s ON s.id = pm.shopify_id
      WHERE pm.nhanh_id IN (
        SELECT nhanh_id 
        FROM phone_matches 
        GROUP BY nhanh_id 
        HAVING SUM(match_count) = 1
      )
      ON CONFLICT ("nhanhCustomerId") DO NOTHING;
    `;

    // Clean up
    await prisma.$executeRaw`DROP TABLE IF EXISTS phone_matches;`;

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 Auto-match completed in ${duration}s! Created ${result} mappings`);

    return NextResponse.json({
      success: true,
      data: {
        matched: Number(result),
        duration: `${duration}s`,
        message: `SQL-based auto-match completed: ${result} customers matched in ${duration}s`,
      },
    });
  } catch (error: any) {
    console.error("Error in SQL auto-match:", error);
    
    // Clean up on error
    try {
      await prisma.$executeRaw`DROP TABLE IF EXISTS phone_matches;`;
    } catch (e) {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to auto-match customers",
      },
      { status: 500 }
    );
  }
}
