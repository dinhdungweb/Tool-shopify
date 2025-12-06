import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyProductAPI } from "@/lib/shopify-product-api";
import { SyncStatus, SyncAction } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/webhooks/nhanh/inventory
 * Webhook endpoint to receive inventory changes from Nhanh.vn
 * Automatically syncs inventory to Shopify for mapped products
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse webhook payload
    const payload = await request.json();

    console.log("📦 Received Nhanh inventory webhook:", {
      event: payload.event,
      businessId: payload.businessId,
      productsCount: payload.data?.length || 0,
    });

    // Validate webhook
    if (payload.event !== "inventoryChange") {
      return NextResponse.json(
        { success: false, error: "Invalid event type" },
        { status: 400 }
      );
    }

    if (!payload.data || !Array.isArray(payload.data)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload data" },
        { status: 400 }
      );
    }

    // Get store ID from env (if using specific depot for legacy mode)
    const storeId = process.env.NHANH_STORE_ID;

    // Fetch active location mappings once
    const locationMappings = await prisma.locationMapping.findMany({
      where: { active: true },
    });

    console.log(`ℹ️ Multi-location sync active: ${locationMappings.length > 0 ? "Yes" : "No"} (${locationMappings.length} mappings)`);

    // Process inventory changes
    const results = {
      total: payload.data.length,
      synced: 0,
      skipped: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const product of payload.data) {
      try {
        const nhanhProductId = product.id.toString();

        // 1. Find mapping for this Nhanh product first
        const mapping = await prisma.productMapping.findUnique({
          where: { nhanhProductId },
        });

        if (!mapping || !mapping.shopifyProductId) {
          console.log(`  ⏭️  Skipped: No mapping found for product ${nhanhProductId}`);
          results.skipped++;
          results.details.push({
            nhanhProductId,
            nhanhSku: product.code,
            status: "skipped",
            reason: "No mapping found",
          });
          continue;
        }

        // 2. Determine Logic: Multi-Location vs Single-Location
        let totalQuantity = 0;

        if (locationMappings.length > 0 && product.depots) {
          // --- MULTI-LOCATION SYNC ---
          // Iterate through mappings and sync specific depots to Shopify locations

          for (const locMap of locationMappings) {
            const depot = product.depots.find((d: any) => d.id.toString() === locMap.nhanhDepotId);
            const depotQty = depot ? parseFloat(depot.available || "0") : 0;

            await shopifyProductAPI.updateVariantInventory(
              mapping.shopifyProductId,
              Math.floor(depotQty),
              undefined, // inventoryItemId (optional)
              locMap.shopifyLocationId
            );
            console.log(`     -> Synced Depot '${locMap.nhanhDepotName}' (${depotQty}) to Location '${locMap.shopifyLocationName}'`);
          }

          // Use total available for local DB record
          totalQuantity = parseFloat(product.available || "0");

        } else {
          // --- SINGLE LOCATION SYNC (Legacy/Default) ---

          // Calculate quantity based on env config or total
          if (storeId && product.depots) {
            const depot = product.depots.find((d: any) => d.id.toString() === storeId);
            totalQuantity = depot ? parseFloat(depot.available || "0") : 0;
          } else {
            totalQuantity = parseFloat(product.available || "0");
          }

          // Sync to primary location (default)
          console.log(`  🔄 Syncing to Shopify product ${mapping.shopifyProductId} (Default Location)...`);
          await shopifyProductAPI.updateVariantInventory(
            mapping.shopifyProductId,
            Math.floor(totalQuantity)
          );
        }

        console.log(`  📊 Product ${nhanhProductId} (${product.code}): ${totalQuantity} total available`);

        // 3. Update Nhanh product quantity in local database
        await prisma.nhanhProduct.update({
          where: { id: nhanhProductId },
          data: {
            quantity: Math.floor(totalQuantity),
            lastPulledAt: new Date(),
          },
        });

        // 4. Update mapping status
        await prisma.productMapping.update({
          where: { id: mapping.id },
          data: {
            syncStatus: "SYNCED",
            lastSyncedAt: new Date(),
            syncError: null,
            syncAttempts: 0,
          },
        });

        // 5. Log sync
        await prisma.productSyncLog.create({
          data: {
            mappingId: mapping.id,
            action: SyncAction.INVENTORY_UPDATE,
            status: SyncStatus.SYNCED,
            message: `Webhook: Updated inventory to ${totalQuantity} (Multi-loc: ${locationMappings.length > 0})`,
            metadata: {
              source: "nhanh_webhook",
              nhanhProductId,
              shopifyProductId: mapping.shopifyProductId,
              totalQuantity,
              locationMappingsCount: locationMappings.length,
              storeId: storeId || "all",
            },
          },
        });

        results.synced++;
        results.details.push({
          nhanhProductId,
          nhanhSku: product.code,
          shopifyProductId: mapping.shopifyProductId,
          quantity: totalQuantity,
          status: "synced",
        });

        console.log(`  ✅ Synced successfully`);

      } catch (productError: any) {
        console.error(`  ❌ Error processing product ${product.id}:`, productError.message);

        results.failed++;
        results.details.push({
          nhanhProductId: product.id.toString(),
          nhanhSku: product.code,
          status: "failed",
          error: productError.message,
        });

        // Try to log error if mapping exists
        try {
          const mapping = await prisma.productMapping.findUnique({
            where: { nhanhProductId: product.id.toString() },
          });

          if (mapping) {
            await prisma.productMapping.update({
              where: { id: mapping.id },
              data: {
                syncStatus: "FAILED",
                syncError: productError.message,
                syncAttempts: { increment: 1 },
              },
            });

            await prisma.productSyncLog.create({
              data: {
                mappingId: mapping.id,
                action: SyncAction.INVENTORY_UPDATE,
                status: SyncStatus.FAILED,
                message: `Webhook: Failed to update inventory`,
                errorDetail: productError.message,
                metadata: {
                  source: "nhanh_webhook",
                  nhanhProductId: product.id.toString(),
                },
              },
            });
          }
        } catch (logError) {
          console.error("Failed to log error:", logError);
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Webhook processed in ${duration}s:`);
    console.log(`   - Total: ${results.total}`);
    console.log(`   - Synced: ${results.synced}`);
    console.log(`   - Skipped: ${results.skipped}`);
    console.log(`   - Failed: ${results.failed}`);

    return NextResponse.json({
      success: true,
      data: results,
      duration: `${duration}s`,
      message: `Processed ${results.total} products: ${results.synced} synced, ${results.skipped} skipped, ${results.failed} failed`,
    });

  } catch (error: any) {
    console.error("❌ Webhook error:", error);

    // Log webhook error
    try {
      const body = await request.clone().text();
      await prisma.webhookLog.create({
        data: {
          source: "nhanh",
          eventType: "inventoryChange",
          payload: JSON.parse(body),
          processed: false,
          error: error.message,
        },
      });
    } catch (logError) {
      console.error("Failed to log webhook error:", logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process webhook",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/nhanh/inventory
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Nhanh inventory webhook endpoint is ready",
    endpoint: "/api/webhooks/nhanh/inventory",
    method: "POST",
    event: "inventoryChange",
  });
}
