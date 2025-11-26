import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes timeout

/**
 * POST /api/sync/auto-match-products
 * Auto-match products between Nhanh and Shopify using SKU
 * Ultra-optimized version using raw SQL with JOIN
 * 
 * Strategy:
 * 1. Use SQL to find matches by SKU directly in database
 * 2. Handle exact SKU matching (case-insensitive)
 * 3. Bulk insert all mappings at once
 */
export async function POST(request: NextRequest) {
  try {
    const { dryRun = false } = await request.json().catch(() => ({ dryRun: false }));

    console.log(`🚀 Starting SQL-optimized product auto-match...`);
    const startTime = Date.now();

    // Step 1: Find matches using raw SQL with SKU matching
    console.log("🔍 Finding matches with SQL JOIN on SKU...");
    
    const matchQuery = `
      SELECT 
        np.id as nhanh_id,
        np.name as nhanh_name,
        np.sku as nhanh_sku,
        np.barcode as nhanh_barcode,
        np.price as nhanh_price,
        sp.id as shopify_id,
        sp.title as shopify_title,
        sp.sku as shopify_sku,
        sp.barcode as shopify_barcode
      FROM nhanh_products np
      LEFT JOIN product_mappings pm ON pm."nhanhProductId" = np.id
      INNER JOIN shopify_products sp ON (
        -- Match by SKU (case-insensitive, trimmed)
        LOWER(TRIM(np.sku)) = LOWER(TRIM(sp.sku))
        AND np.sku IS NOT NULL 
        AND sp.sku IS NOT NULL
        AND TRIM(np.sku) != ''
        AND TRIM(sp.sku) != ''
      )
      WHERE 
        pm.id IS NULL  -- Not yet mapped
    `;

    const matches: any[] = await prisma.$queryRawUnsafe(matchQuery);
    
    console.log(`✅ Found ${matches.length} potential matches by SKU`);

    // Step 2: Filter to only exact 1-to-1 matches
    // Group by Nhanh product ID to check for duplicates
    const nhanhMatchMap = new Map<string, any[]>();
    matches.forEach((match) => {
      if (!nhanhMatchMap.has(match.nhanh_id)) {
        nhanhMatchMap.set(match.nhanh_id, []);
      }
      nhanhMatchMap.get(match.nhanh_id)!.push(match);
    });

    // Group by Shopify product ID to check for duplicates
    const shopifyMatchMap = new Map<string, any[]>();
    matches.forEach((match) => {
      if (!shopifyMatchMap.has(match.shopify_id)) {
        shopifyMatchMap.set(match.shopify_id, []);
      }
      shopifyMatchMap.get(match.shopify_id)!.push(match);
    });

    // Only keep 1-to-1 matches (one Nhanh product matches one Shopify product)
    const exactMatches = Array.from(nhanhMatchMap.entries())
      .filter(([nhanhId, matches]) => {
        if (matches.length !== 1) return false;
        const shopifyId = matches[0].shopify_id;
        return shopifyMatchMap.get(shopifyId)?.length === 1;
      })
      .map(([_, matches]) => matches[0]);

    console.log(`✅ Filtered to ${exactMatches.length} exact 1-to-1 matches`);

    const skippedNhanh = nhanhMatchMap.size - exactMatches.length;
    const skippedShopify = shopifyMatchMap.size - exactMatches.length;

    const results = {
      total: matches.length,
      matched: exactMatches.length,
      failed: 0,
      skipped: Math.max(skippedNhanh, skippedShopify),
      // Only return first 100 details to avoid huge response
      details: exactMatches.slice(0, 100).map((match) => ({
        nhanhProduct: {
          id: match.nhanh_id,
          name: match.nhanh_name,
          sku: match.nhanh_sku,
        },
        shopifyProduct: {
          id: match.shopify_id,
          title: match.shopify_title,
          sku: match.shopify_sku,
        },
        status: "matched",
      })),
    };

    // Step 3: Bulk create mappings in batches
    if (!dryRun && exactMatches.length > 0) {
      console.log(`💾 Creating ${exactMatches.length} product mappings in batches...`);
      
      const batchSize = 500;
      const totalBatches = Math.ceil(exactMatches.length / batchSize);
      let createdCount = 0;
      
      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, exactMatches.length);
        const batch = exactMatches.slice(start, end);
        
        // Build VALUES clause for this batch
        const values = batch.map((match) => {
          const nhanhName = (match.nhanh_name || '').replace(/'/g, "''");
          const nhanhSku = (match.nhanh_sku || '').replace(/'/g, "''");
          const nhanhBarcode = (match.nhanh_barcode || '').replace(/'/g, "''");
          const shopifyTitle = (match.shopify_title || '').replace(/'/g, "''");
          const shopifySku = (match.shopify_sku || '').replace(/'/g, "''");
          const shopifyBarcode = (match.shopify_barcode || '').replace(/'/g, "''");
          
          return `(
            gen_random_uuid(),
            NOW(),
            NOW(),
            '${match.nhanh_id}',
            '${nhanhName}',
            ${match.nhanh_sku ? `'${nhanhSku}'` : 'NULL'},
            ${match.nhanh_barcode ? `'${nhanhBarcode}'` : 'NULL'},
            ${match.nhanh_price || 0},
            '${match.shopify_id}',
            NULL,
            ${match.shopify_title ? `'${shopifyTitle}'` : 'NULL'},
            ${match.shopify_sku ? `'${shopifySku}'` : 'NULL'},
            ${match.shopify_barcode ? `'${shopifyBarcode}'` : 'NULL'},
            'PENDING',
            0
          )`;
        }).join(',\n');

        const insertQuery = `
          INSERT INTO product_mappings (
            id,
            "createdAt",
            "updatedAt",
            "nhanhProductId",
            "nhanhProductName",
            "nhanhSku",
            "nhanhBarcode",
            "nhanhPrice",
            "shopifyProductId",
            "shopifyVariantId",
            "shopifyProductTitle",
            "shopifySku",
            "shopifyBarcode",
            "syncStatus",
            "syncAttempts"
          )
          VALUES ${values}
          ON CONFLICT ("nhanhProductId") DO NOTHING
        `;

        await prisma.$executeRawUnsafe(insertQuery);
        createdCount += batch.length;
        console.log(`  ✅ Batch ${i + 1}/${totalBatches}: Created ${batch.length} mappings (total: ${createdCount}/${exactMatches.length})`);
      }
      
      console.log(`✅ Bulk insert completed: ${createdCount} product mappings created`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ SQL product auto-match completed in ${duration}s`);

    return NextResponse.json({
      success: true,
      data: {
        ...results,
        dryRun,
        duration: `${duration}s`,
        method: "SQL JOIN by SKU",
        message: dryRun
          ? `Dry run completed in ${duration}s: ${results.matched} potential matches found`
          : `Auto-match completed in ${duration}s: ${results.matched} products matched by SKU`,
      },
    });
  } catch (error: any) {
    console.error("Error in SQL product auto-match:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to auto-match products",
      },
      { status: 500 }
    );
  }
}
