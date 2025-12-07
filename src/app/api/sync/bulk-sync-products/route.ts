// API Route: Bulk Sync Products in Background
// ULTRA OPTIMIZED: Higher parallelism, smarter batching, reduced delays
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyProductAPI } from "@/lib/shopify-product-api";
import { nhanhProductAPI } from "@/lib/nhanh-product-api";
import { SyncStatus } from "@prisma/client";
import { evaluateRules } from "@/lib/sync-rules-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

/**
 * POST /api/sync/bulk-sync-products
 * ULTRA OPTIMIZED bulk sync with higher throughput
 * Target: ~4-5 products/sec (safe for Shopify rate limits)
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

    // Get location mappings
    const locationMappings = await prisma.locationMapping.findMany({
      where: { active: true },
    });

    // Group by Shopify location for SUM logic
    const locationGroups = new Map<string, {
      locationId: string;
      locationName: string;
      depots: { id: string; name: string }[]
    }>();

    for (const locMapping of locationMappings) {
      const existing = locationGroups.get(locMapping.shopifyLocationId);
      if (existing) {
        existing.depots.push({ id: locMapping.nhanhDepotId, name: locMapping.nhanhDepotName });
      } else {
        locationGroups.set(locMapping.shopifyLocationId, {
          locationId: locMapping.shopifyLocationId,
          locationName: locMapping.shopifyLocationName,
          depots: [{ id: locMapping.nhanhDepotId, name: locMapping.nhanhDepotName }],
        });
      }
    }

    const syncMode = locationMappings.length > 0 ? "multi-location-sum" : "single-location";

    // Create background job
    const job = await prisma.backgroundJob.create({
      data: {
        type: "PRODUCT_SYNC",
        total: mappingIds.length,
        status: "RUNNING",
        metadata: {
          estimatedSpeed: "~4-5 products/sec",
          estimatedTime: `~${Math.ceil(mappingIds.length / 4 / 60)} minutes`,
          syncMode,
          locationCount: locationGroups.size,
        },
      },
    });

    // Start background processing
    bulkSyncOptimized(mappingIds, job.id, locationGroups);

    return NextResponse.json({
      success: true,
      data: {
        total: mappingIds.length,
        jobId: job.id,
        syncMode,
        message: `Ultra optimized sync started for ${mappingIds.length} products (~4-5 products/sec).`,
      },
    });
  } catch (error: any) {
    console.error("Error starting sync:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

interface LocationGroup {
  locationId: string;
  locationName: string;
  depots: { id: string; name: string }[];
}

async function bulkSyncOptimized(
  mappingIds: string[],
  jobId: string,
  locationGroups: Map<string, LocationGroup>
) {
  const isMultiLocation = locationGroups.size > 0;
  console.log(`🚀 ULTRA OPTIMIZED sync: ${mappingIds.length} products (Job: ${jobId})`);

  const startTime = Date.now();
  let successful = 0;
  let failed = 0;
  let rateLimitHits = 0;

  // SETTINGS FOR MULTI-LOCATION SYNC:
  // Shopify REST API: 2 req/sec base, 40 bucket (burst capacity)
  // Multi-location = 2x API calls per product (one per location)
  // Safe rate: 4 parallel @ 2s delay = ~2 req/sec (sustainable)
  const NHANH_BATCH_SIZE = 100; // Max supported by Nhanh API
  const SHOPIFY_PARALLEL_SIZE = isMultiLocation ? 4 : 8; // Fewer parallel calls for multi-location
  const SHOPIFY_BATCH_DELAY = isMultiLocation ? 2000 : 1500; // Longer delay for multi-location
  const RATE_LIMIT_DELAY = 15000; // 15s recovery when rate limited

  // Get all mappings
  const mappings = await prisma.productMapping.findMany({
    where: { id: { in: mappingIds } },
  });

  const validMappings = mappings.filter(m => m.shopifyProductId && m.shopifyVariantId);
  const invalidCount = mappings.length - validMappings.length;

  if (invalidCount > 0) {
    console.log(`⚠️ Skipping ${invalidCount} invalid mappings`);
    failed += invalidCount;
  }

  // =====================
  // SYNC RULES EVALUATION
  // =====================
  // Evaluate rules for each mapping and filter out skipped/approval-needed ones
  const mappingsToSync: typeof validMappings = [];
  let skippedByRules = 0;
  let pendingApproval = 0;

  for (const mapping of validMappings) {
    try {
      const rulesResult = await evaluateRules({ type: "product", mapping });

      if (rulesResult.skipSync) {
        skippedByRules++;
        await prisma.productMapping.update({
          where: { id: mapping.id },
          data: { syncStatus: SyncStatus.SYNCED, syncError: null },
        }).catch(() => { });
        console.log(`⏭️ Skipped by rule: ${mapping.nhanhProductName}`);
        continue;
      }

      if (rulesResult.requireApproval) {
        pendingApproval++;
        await prisma.productMapping.update({
          where: { id: mapping.id },
          data: {
            syncStatus: "PENDING_APPROVAL" as any,
            syncError: `Requires approval: ${rulesResult.approvalReason}`,
          },
        }).catch(() => { });
        console.log(`⏸️ Pending approval: ${mapping.nhanhProductName}`);
        continue;
      }

      mappingsToSync.push(mapping);
    } catch (err) {
      mappingsToSync.push(mapping); // On error, proceed with sync
    }
  }

  if (skippedByRules > 0 || pendingApproval > 0) {
    console.log(`📋 Rules: ${skippedByRules} skipped, ${pendingApproval} pending approval`);
    successful += skippedByRules; // Count skipped as successful (processed)
  }

  // Collect all unique depot IDs upfront
  const allDepotIds: string[] = [];
  for (const group of locationGroups.values()) {
    for (const depot of group.depots) {
      if (!allDepotIds.includes(depot.id)) {
        allDepotIds.push(depot.id);
      }
    }
  }

  // Split filtered mappings into batches
  const nhanhBatches: typeof mappingsToSync[] = [];
  for (let i = 0; i < mappingsToSync.length; i += NHANH_BATCH_SIZE) {
    nhanhBatches.push(mappingsToSync.slice(i, i + NHANH_BATCH_SIZE));
  }

  console.log(`📦 ${nhanhBatches.length} batches (${NHANH_BATCH_SIZE} products/batch)`);
  console.log(`⚡ ${SHOPIFY_PARALLEL_SIZE} parallel Shopify calls, ${SHOPIFY_BATCH_DELAY}ms delay\n`);

  for (let batchIndex = 0; batchIndex < nhanhBatches.length; batchIndex++) {
    const nhanhBatch = nhanhBatches[batchIndex];
    const progress = ((batchIndex / nhanhBatches.length) * 100).toFixed(1);

    console.log(`\n📦 Batch ${batchIndex + 1}/${nhanhBatches.length} (${progress}%) ✅${successful} ❌${failed}`);

    try {
      const productIds = nhanhBatch.map(m => m.nhanhProductId);

      // Fetch ALL depot inventories in ONE go for this batch
      // Key optimization: 1 API call for all depots instead of N calls
      const allInventories = new Map<string, Map<string, number>>(); // productId -> depotId -> qty

      // Also fetch TOTAL inventory as fallback for products not in specific depots
      const fallbackInventory = await nhanhProductAPI.getBatchProductInventory(productIds);

      if (isMultiLocation && allDepotIds.length > 0) {
        // Fetch from all depots in parallel (one API call per depot, but parallel)
        const depotPromises = allDepotIds.map(async (depotId) => {
          const inventoryMap = await nhanhProductAPI.getBatchProductInventoryByDepot(productIds, depotId);
          return { depotId, inventoryMap };
        });

        const depotResults = await Promise.all(depotPromises);

        for (const { depotId, inventoryMap } of depotResults) {
          for (const [productId, inv] of inventoryMap) {
            if (!allInventories.has(productId)) {
              allInventories.set(productId, new Map());
            }
            allInventories.get(productId)!.set(depotId, inv.quantity);
          }
        }

        // FALLBACK: For products NOT found in any depot, use total inventory
        for (const productId of productIds) {
          if (!allInventories.has(productId) && fallbackInventory.has(productId)) {
            const totalInv = fallbackInventory.get(productId)!;
            // Create a map with first depot as key - will be summed later
            allInventories.set(productId, new Map([[allDepotIds[0], totalInv.quantity]]));
            console.log(`⚡ Fallback: Product ${productId} using total inventory: ${totalInv.quantity}`);
          }
        }
      }

      // Now sync to each Shopify location
      if (isMultiLocation) {
        for (const [shopifyLocationId, group] of locationGroups) {
          // Process in parallel sub-batches
          const shopifyBatches: typeof nhanhBatch[] = [];
          for (let i = 0; i < nhanhBatch.length; i += SHOPIFY_PARALLEL_SIZE) {
            shopifyBatches.push(nhanhBatch.slice(i, i + SHOPIFY_PARALLEL_SIZE));
          }

          for (const shopifyBatch of shopifyBatches) {
            const batchStartTime = Date.now();

            const results = await Promise.all(shopifyBatch.map(async (mapping) => {
              const productDepots = allInventories.get(mapping.nhanhProductId);

              // SUM quantities from all mapped depots
              // If product not found in Nhanh response, it means inventory = 0 or empty
              let totalQuantity = 0;
              if (productDepots) {
                for (const depot of group.depots) {
                  totalQuantity += productDepots.get(depot.id) || 0;
                }
              } else {
                // Product not in Nhanh response = inventory is 0 or empty on Nhanh
                console.log(`⚠️ Product ${mapping.nhanhProductId} not in Nhanh response, syncing as qty=0`);
              }

              try {
                const result = await shopifyProductAPI.updateVariantInventory(
                  mapping.shopifyVariantId!,
                  totalQuantity,
                  mapping.shopifyInventoryItemId || undefined,
                  shopifyLocationId
                );

                // Update mapping (don't await, fire and forget for speed)
                prisma.productMapping.update({
                  where: { id: mapping.id },
                  data: {
                    syncStatus: SyncStatus.SYNCED,
                    lastSyncedAt: new Date(),
                    syncError: null,
                    shopifyInventoryItemId: result.inventoryItemId,
                  },
                }).catch(() => { });

                return { success: true, mappingId: mapping.id };
              } catch (error: any) {
                const msg = error.message || "";
                console.error(`❌ Failed to sync ${mapping.nhanhProductId} → ${mapping.shopifyVariantId}: ${msg}`);

                if (msg.includes("429") || msg.includes("Rate") || msg.includes("throttl")) {
                  return { success: false, mappingId: mapping.id, isRateLimit: true };
                }

                prisma.productMapping.update({
                  where: { id: mapping.id },
                  data: { syncStatus: SyncStatus.FAILED, syncError: msg.substring(0, 500) },
                }).catch(() => { });

                return { success: false, mappingId: mapping.id, error: msg };
              }
            }));

            let batchRateLimited = false;
            for (const r of results) {
              if (r.success) successful++;
              else {
                failed++;
                if (r.isRateLimit) {
                  rateLimitHits++;
                  batchRateLimited = true;
                }
              }
            }

            // Update progress every batch
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = (successful + failed) / elapsed;

            await prisma.backgroundJob.update({
              where: { id: jobId },
              data: {
                processed: successful + failed,
                successful,
                failed,
                metadata: { speed: `${speed.toFixed(1)} products/sec`, rateLimitHits },
              },
            }).catch(() => { });

            // Smart delay: if batch was fast, wait longer to avoid rate limits
            const batchDuration = Date.now() - batchStartTime;
            const waitTime = batchRateLimited
              ? RATE_LIMIT_DELAY
              : Math.max(0, SHOPIFY_BATCH_DELAY - batchDuration);

            if (waitTime > 0) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }
      } else {
        // Single-location sync
        const inventoryMap = await nhanhProductAPI.getBatchProductInventory(productIds);

        const shopifyBatches: typeof nhanhBatch[] = [];
        for (let i = 0; i < nhanhBatch.length; i += SHOPIFY_PARALLEL_SIZE) {
          shopifyBatches.push(nhanhBatch.slice(i, i + SHOPIFY_PARALLEL_SIZE));
        }

        for (const shopifyBatch of shopifyBatches) {
          const batchStartTime = Date.now();

          const results = await Promise.all(shopifyBatch.map(async (mapping) => {
            const inventory = inventoryMap.get(mapping.nhanhProductId);

            // If product not in Nhanh response, it means inventory = 0 or empty
            const quantity = inventory?.quantity ?? 0;
            if (!inventory) {
              console.log(`⚠️ Product ${mapping.nhanhProductId} not in Nhanh response, syncing as qty=0`);
            }

            try {
              const result = await shopifyProductAPI.updateVariantInventory(
                mapping.shopifyVariantId!,
                quantity,
                mapping.shopifyInventoryItemId || undefined
              );

              prisma.productMapping.update({
                where: { id: mapping.id },
                data: {
                  syncStatus: SyncStatus.SYNCED,
                  lastSyncedAt: new Date(),
                  syncError: null,
                  shopifyInventoryItemId: result.inventoryItemId,
                },
              }).catch(() => { });

              return { success: true, mappingId: mapping.id };
            } catch (error: any) {
              const msg = error.message || "";
              if (msg.includes("429") || msg.includes("Rate") || msg.includes("throttl")) {
                return { success: false, mappingId: mapping.id, isRateLimit: true };
              }
              return { success: false, mappingId: mapping.id };
            }
          }));

          let batchRateLimited = false;
          for (const r of results) {
            if (r.success) successful++;
            else {
              failed++;
              if (r.isRateLimit) {
                rateLimitHits++;
                batchRateLimited = true;
              }
            }
          }

          const elapsed = (Date.now() - startTime) / 1000;
          const speed = (successful + failed) / elapsed;

          await prisma.backgroundJob.update({
            where: { id: jobId },
            data: {
              processed: successful + failed,
              successful,
              failed,
              metadata: { speed: `${speed.toFixed(1)} products/sec`, rateLimitHits },
            },
          }).catch(() => { });

          const batchDuration = Date.now() - batchStartTime;
          const waitTime = batchRateLimited
            ? RATE_LIMIT_DELAY
            : Math.max(0, SHOPIFY_BATCH_DELAY - batchDuration);

          if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ Batch error:`, error.message);
      failed += nhanhBatch.length;
    }
  }

  const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
  const speed = durationSeconds > 0 ? ((successful + failed) / durationSeconds).toFixed(1) : "0";
  const durationFormatted = durationSeconds < 60 ? `${durationSeconds}s` : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;

  console.log(`\n🎉 Completed in ${durationFormatted} (${speed} products/sec)`);
  console.log(`✅ ${successful} | ❌ ${failed}`);

  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      processed: successful + failed,
      successful,
      failed,
      completedAt: new Date(),
      metadata: {
        duration: durationFormatted,
        speed: `${speed} products/sec`,
        rateLimitHits,
      },
    },
  }).catch(() => { });
}
