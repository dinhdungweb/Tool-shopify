import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes timeout

/**
 * POST /api/sync/auto-match-sql
 * Ultra-optimized version using raw SQL with JOIN
 * Fastest method for very large datasets (200k+ records)
 * 
 * Strategy:
 * 1. Use SQL to find matches directly in database
 * 2. Handle phone normalization in SQL
 * 3. Bulk insert all mappings at once
 */
export async function POST(request: NextRequest) {
  try {
    const { dryRun = false } = await request.json();

    console.log(`🚀 Starting SQL-optimized auto-match...`);
    const startTime = Date.now();

    // Step 1: Find matches using raw SQL with phone normalization
    console.log("🔍 Finding matches with SQL JOIN...");
    
    const matchQuery = `
      SELECT 
        nc.id as nhanh_id,
        nc.name as nhanh_name,
        nc.phone as nhanh_phone,
        nc.email as nhanh_email,
        nc."totalSpent" as nhanh_total_spent,
        sc.id as shopify_id,
        sc."firstName" as shopify_first_name,
        sc."lastName" as shopify_last_name,
        sc.email as shopify_email
      FROM nhanh_customers nc
      LEFT JOIN customer_mappings cm ON cm."nhanhCustomerId" = nc.id
      INNER JOIN shopify_customers sc ON (
        -- Exact match
        nc.phone = sc.phone
        OR
        -- Nhanh: 0xxx, Shopify: +84xxx
        (nc.phone LIKE '0%' AND sc.phone = '+84' || SUBSTRING(nc.phone, 2))
        OR
        -- Nhanh: +84xxx, Shopify: 0xxx
        (nc.phone LIKE '+84%' AND sc.phone = '0' || SUBSTRING(nc.phone, 4))
        OR
        -- Shopify: 0xxx, Nhanh: +84xxx
        (sc.phone LIKE '0%' AND nc.phone = '+84' || SUBSTRING(sc.phone, 2))
        OR
        -- Shopify: +84xxx, Nhanh: 0xxx
        (sc.phone LIKE '+84%' AND nc.phone = '0' || SUBSTRING(sc.phone, 4))
      )
      WHERE 
        cm.id IS NULL  -- Not yet mapped
        AND nc.phone IS NOT NULL
        AND sc.phone IS NOT NULL
    `;

    const matches: any[] = await prisma.$queryRawUnsafe(matchQuery);
    
    console.log(`✅ Found ${matches.length} potential matches`);

    // Step 2: Filter to only exact 1-to-1 matches
    const matchMap = new Map<string, any[]>();
    matches.forEach((match) => {
      if (!matchMap.has(match.nhanh_id)) {
        matchMap.set(match.nhanh_id, []);
      }
      matchMap.get(match.nhanh_id)!.push(match);
    });

    const exactMatches = Array.from(matchMap.entries())
      .filter(([_, matches]) => matches.length === 1)
      .map(([_, matches]) => matches[0]);

    console.log(`✅ Filtered to ${exactMatches.length} exact 1-to-1 matches`);

    const results = {
      total: matchMap.size,
      matched: exactMatches.length,
      failed: 0,
      skipped: matchMap.size - exactMatches.length,
      // Only return first 100 details to avoid huge response
      // But ALL matches will be created in database
      details: exactMatches.slice(0, 100).map((match) => ({
        nhanhCustomer: {
          id: match.nhanh_id,
          name: match.nhanh_name,
          phone: match.nhanh_phone,
        },
        shopifyCustomer: {
          id: match.shopify_id,
          name: `${match.shopify_first_name || ""} ${match.shopify_last_name || ""}`.trim(),
          email: match.shopify_email,
        },
        status: "matched",
      })),
    };

    // Step 3: Bulk create mappings in batches to avoid query size limits
    if (!dryRun && exactMatches.length > 0) {
      console.log(`💾 Creating ${exactMatches.length} mappings in batches...`);
      
      const batchSize = 500; // Insert 500 records per batch
      const totalBatches = Math.ceil(exactMatches.length / batchSize);
      let createdCount = 0;
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, exactMatches.length);
        const batch = exactMatches.slice(start, end);
        
        // Build VALUES clause for this batch
        const values = batch.map((match) => {
          const nhanhName = (match.nhanh_name || '').replace(/'/g, "''");
          const nhanhPhone = (match.nhanh_phone || '').replace(/'/g, "''");
          const nhanhEmail = (match.nhanh_email || '').replace(/'/g, "''");
          const shopifyName = `${match.shopify_first_name || ""} ${match.shopify_last_name || ""}`.trim().replace(/'/g, "''");
          const shopifyEmail = (match.shopify_email || '').replace(/'/g, "''");
          
          return `(
            gen_random_uuid(),
            NOW(),
            NOW(),
            '${match.nhanh_id}',
            '${nhanhName}',
            ${match.nhanh_phone ? `'${nhanhPhone}'` : 'NULL'},
            ${match.nhanh_email ? `'${nhanhEmail}'` : 'NULL'},
            ${match.nhanh_total_spent || 0},
            '${match.shopify_id}',
            ${match.shopify_email ? `'${shopifyEmail}'` : 'NULL'},
            '${shopifyName}',
            'PENDING',
            0
          )`;
        }).join(',\n');

        const insertQuery = `
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
            "syncStatus",
            "syncAttempts"
          )
          VALUES ${values}
          ON CONFLICT ("nhanhCustomerId") DO NOTHING
        `;

        await prisma.$executeRawUnsafe(insertQuery);
        createdCount += batch.length;
        console.log(`  ✅ Batch ${i + 1}/${totalBatches}: Created ${batch.length} mappings (total: ${createdCount}/${exactMatches.length})`);
      }
      
      console.log(`✅ Bulk insert completed: ${createdCount} mappings created`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ SQL auto-match completed in ${duration}s`);

    return NextResponse.json({
      success: true,
      data: {
        ...results,
        dryRun,
        duration: `${duration}s`,
        method: "SQL JOIN",
        message: dryRun
          ? `Dry run completed in ${duration}s: ${results.matched} potential matches found`
          : `Auto-match completed in ${duration}s: ${results.matched} customers matched using SQL JOIN`,
      },
    });
  } catch (error: any) {
    console.error("Error in SQL auto-match:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to auto-match customers",
      },
      { status: 500 }
    );
  }
}
