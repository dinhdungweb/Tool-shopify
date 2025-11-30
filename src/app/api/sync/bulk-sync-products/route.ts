// API Route: Bulk Sync Products in Background
// Similar to customer bulk sync - uses local data + Nhanh Inventory API
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyProductAPI } from "@/lib/shopify-product-api";
import { nhanhProductAPI } from "@/lib/nhanh-product-api";
import { SyncStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

/**
 * POST /api/sync/bulk-sync-products
 * Start background sync for products (returns immediately)
 * Similar to customer bulk sync
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappingIds } = body;

    if (!mappingIds || !Array.isArray(mappingIds) || mappingIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "mappingIds array is required" },
        { status: 400 }
      );
    }

    // Create background job for tracking
    const job = await prisma.backgroundJob.create({
      data: {
        type: "PRODUCT_SYNC",
        total: mappingIds.length,
        status: "RUNNING",
        metadata: {
          estimatedSpeed: "~2 products/sec",
          estimatedTime: `~${Math.ceil(mappingIds.length / 2 / 60)} minutes`,
        },
      },
    });

    // Start background processing (don't await)
    bulkSyncProductsBackground(mappingIds, job.id);

    return NextResponse.json({
      success: true,
      data: {
        total: mappingIds.length,
        jobId: job.id,
        message: `Background sync started for ${mappingIds.length} products. Check progress in UI.`,
      },
    });
  } catch (error: any) {
    console.error("Error starting background sync:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function bulkSyncProductsBackground(mappingIds: string[], jobId: string) {
  console.log(`🚀 Starting SUPER OPTIMIZED bulk sync for ${mappingIds.length} products (Job: ${jobId})...`);
  const startTime = Date.now();

  let successful = 0;
  let failed = 0;
  let rateLimitHits = 0;

  // OPTIMIZED settings for ~2 variants/sec (with inventoryItemId cache):
  // updateVariantInventory = 1 API call when inventoryItemId is cached in DB
  // Shopify REST API limit: 2 calls/second (bucket 40, refill 2/sec)
  // Using 5 parallel with 2.5s delay:
  // - With cache: 5 x 1 = 5 calls / 2.5s = 2 calls/sec (exactly at limit)
  // - Without cache (first time): 5 x 2 = 10 calls / 2.5s = 4 calls/sec (uses bucket)
  // After pull products with inventoryItemId, all syncs will be fast!
  const NHANH_BATCH_SIZE = 50; // Nhanh API supports up to 100
  const SHOPIFY_PARALLEL_SIZE = 5; // 5 parallel (safe with cache)
  const SHOPIFY_BATCH_DELAY = 2500; // 2.5s delay
  const RATE_LIMIT_DELAY = 30000; // 30 seconds wait on rate limit

  // Get all mappings first
  const mappings = await prisma.productMapping.findMany({
    where: { id: { in: mappingIds } },
  });

  const validMappings = mappings.filter(m => m.shopifyProductId && m.shopifyVariantId);
  const invalidCount = mappings.length - validMappings.length;
  
  if (invalidCount > 0) {
    console.log(`⚠️ Skipping ${invalidCount} invalid mappings (missing Shopify IDs)`);
    failed += invalidCount;
  }

  // Split into Nhanh batches (50 products per API call)
  const nhanhBatches: typeof validMappings[] = [];
  for (let i = 0; i < validMappings.length; i += NHANH_BATCH_SIZE) {
    nhanhBatches.push(validMappings.slice(i, i + NHANH_BATCH_SIZE));
  }

  const totalShopifyBatches = Math.ceil(validMappings.length / SHOPIFY_PARALLEL_SIZE);
  // Estimate: ~2 variants/sec (with inventoryItemId cache)
  const estimatedSeconds = Math.ceil(validMappings.length / 2);
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
  
  console.log(`📦 ${nhanhBatches.length} Nhanh API calls (${NHANH_BATCH_SIZE} products each)`);
  console.log(`📦 ~${totalShopifyBatches} Shopify batches (${SHOPIFY_PARALLEL_SIZE} parallel, 2.5s delay)`);
  console.log(`⚙️ Estimated time: ~${estimatedMinutes} minutes (~2 variants/sec with cache)\n`);

  for (let batchIndex = 0; batchIndex < nhanhBatches.length; batchIndex++) {
    const nhanhBatch = nhanhBatches[batchIndex];
    const progress = ((batchIndex / nhanhBatches.length) * 100).toFixed(1);
    
    console.log(`\n📦 Nhanh Batch ${batchIndex + 1}/${nhanhBatches.length} (${progress}%) - ✅ ${successful} | ❌ ${failed}`);

    try {
      // Step 1: Fetch inventory for all products in batch (1 API call!)
      const productIds = nhanhBatch.map(m => m.nhanhProductId);
      const inventoryMap = await nhanhProductAPI.getBatchProductInventory(productIds);
      
      console.log(`  ✓ Fetched inventory for ${inventoryMap.size}/${productIds.length} products`);

      // Step 2: Update Shopify in parallel sub-batches
      const shopifyBatches: typeof nhanhBatch[] = [];
      for (let i = 0; i < nhanhBatch.length; i += SHOPIFY_PARALLEL_SIZE) {
        shopifyBatches.push(nhanhBatch.slice(i, i + SHOPIFY_PARALLEL_SIZE));
      }

      for (const shopifyBatch of shopifyBatches) {
        const shopifyPromises = shopifyBatch.map(async (mapping) => {
          const inventory = inventoryMap.get(mapping.nhanhProductId);
          
          if (!inventory) {
            // Product not found in Nhanh
            await prisma.productMapping.update({
              where: { id: mapping.id },
              data: {
                syncStatus: SyncStatus.FAILED,
                syncError: "Product not found in Nhanh inventory",
                syncAttempts: { increment: 1 },
              },
            });
            return { success: false, mappingId: mapping.id, error: "Not found in Nhanh" };
          }

          try {
            // Update Shopify inventory (pass cached inventoryItemId if available)
            const result = await shopifyProductAPI.updateVariantInventory(
              mapping.shopifyVariantId!,
              inventory.quantity,
              mapping.shopifyInventoryItemId || undefined
            );

            // Update mapping status and cache inventoryItemId
            await prisma.productMapping.update({
              where: { id: mapping.id },
              data: {
                syncStatus: SyncStatus.SYNCED,
                lastSyncedAt: new Date(),
                syncError: null,
                syncAttempts: { increment: 1 },
                // Cache inventoryItemId for next sync (eliminates 1 API call!)
                shopifyInventoryItemId: result.inventoryItemId,
              },
            });

            return { success: true, mappingId: mapping.id, quantity: inventory.quantity };
          } catch (error: any) {
            const errorMessage = error.message || "Unknown error";
            
            if (errorMessage.includes("Rate Limit") || errorMessage.includes("429") || errorMessage.includes("throttl")) {
              return { success: false, mappingId: mapping.id, error: errorMessage, isRateLimit: true };
            }

            await prisma.productMapping.update({
              where: { id: mapping.id },
              data: {
                syncStatus: SyncStatus.FAILED,
                syncError: errorMessage.substring(0, 500),
                syncAttempts: { increment: 1 },
              },
            });

            return { success: false, mappingId: mapping.id, error: errorMessage };
          }
        });

        const results = await Promise.all(shopifyPromises);

        // Count results
        let batchRateLimited = false;
        for (const result of results) {
          if (result.success) {
            successful++;
          } else {
            failed++;
            if (result.isRateLimit) {
              rateLimitHits++;
              batchRateLimited = true;
            }
          }
        }

        // Update job progress
        const processed = successful + failed;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = processed > 0 ? (processed / elapsed).toFixed(1) : "0";
        const remaining = mappingIds.length - processed;
        const eta = processed > 0 ? Math.ceil(remaining / (processed / elapsed)) : 0;
        
        await prisma.backgroundJob.update({
          where: { id: jobId },
          data: {
            processed,
            successful,
            failed,
            metadata: {
              speed: `${speed} products/sec`,
              eta: eta > 60 ? `~${Math.ceil(eta / 60)} min` : `~${eta} sec`,
              rateLimitHits,
            },
          },
        }).catch(() => {}); // Ignore errors

        // Handle rate limit
        if (batchRateLimited) {
          console.warn(`  ⚠️ Shopify rate limit! Waiting ${RATE_LIMIT_DELAY / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        } else {
          // Normal delay between Shopify batches
          await new Promise(resolve => setTimeout(resolve, SHOPIFY_BATCH_DELAY));
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Nhanh batch error:`, error.message);
      // Mark all products in this batch as failed
      for (const mapping of nhanhBatch) {
        failed++;
        try {
          await prisma.productMapping.update({
            where: { id: mapping.id },
            data: {
              syncStatus: SyncStatus.FAILED,
              syncError: `Nhanh API error: ${error.message}`.substring(0, 500),
              syncAttempts: { increment: 1 },
            },
          });
        } catch (e) {
          // Ignore
        }
      }
    }

    // Small delay between Nhanh batches
    if (batchIndex < nhanhBatches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const speed = (mappingIds.length / parseFloat(duration)).toFixed(1);
  
  console.log(`\n🎉 SUPER OPTIMIZED bulk sync completed!`);
  console.log(`⏱️  Duration: ${duration}s (${speed} products/sec)`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  if (rateLimitHits > 0) {
    console.log(`⚠️ Rate limit hits: ${rateLimitHits}`);
  }

  // Update job as completed
  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      processed: successful + failed,
      successful,
      failed,
      completedAt: new Date(),
      metadata: {
        duration: `${duration}s`,
        speed: `${speed} products/sec`,
        rateLimitHits,
      },
    },
  }).catch(() => {}); // Ignore errors
}
