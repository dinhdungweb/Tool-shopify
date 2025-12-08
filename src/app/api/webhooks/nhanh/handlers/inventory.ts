import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyProductAPI } from "@/lib/shopify-product-api";
import { SyncStatus, SyncAction } from "@prisma/client";

/**
 * Handle inventory change webhook
 * Shared logic used by both router and direct endpoint
 */
export async function handleInventoryWebhook(payload: any) {
  const startTime = Date.now();

  try {
    // Validate payload
    if (!payload.data || !Array.isArray(payload.data)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload data" },
        { status: 400 }
      );
    }

    console.log("📦 Processing inventory webhook:", {
      event: payload.event,
      businessId: payload.businessId,
      productsCount: payload.data.length,
    });

    // Get store ID from env (if using specific depot for legacy mode)
    const storeId = process.env.NHANH_STORE_ID;

    // Fetch active location mappings once
    const locationMappings = await prisma.locationMapping.findMany({
      where: { active: true },
    });

    console.log(`ℹ️ Multi-location sync: ${locationMappings.length > 0 ? "Yes" : "No"} (${locationMappings.length} mappings)`);

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

        // Find mapping
        const mapping = await prisma.productMapping.findUnique({
          where: { nhanhProductId },
        });

        if (!mapping || !mapping.shopifyProductId) {
          console.log(`  ⏭️  Skipped: No mapping for ${nhanhProductId}`);
          results.skipped++;
          results.details.push({
            nhanhProductId,
            nhanhSku: product.code,
            status: "skipped",
            reason: "No mapping found",
          });
          continue;
        }

        // Determine sync logic
        let totalQuantity = 0;

        if (locationMappings.length > 0 && product.depots) {
          // Multi-location sync
          for (const locMap of locationMappings) {
            const depot = product.depots.find((d: any) => d.id.toString() === locMap.nhanhDepotId);
            const depotQty = depot ? parseFloat(depot.available || "0") : 0;

            await shopifyProductAPI.updateVariantInventory(
              mapping.shopifyProductId,
              Math.floor(depotQty),
              undefined,
              locMap.shopifyLocationId
            );
            console.log(`     -> Depot '${locMap.nhanhDepotName}' (${depotQty}) → '${locMap.shopifyLocationName}'`);
          }
          totalQuantity = parseFloat(product.available || "0");
        } else {
          // Single location sync
          if (storeId && product.depots) {
            const depot = product.depots.find((d: any) => d.id.toString() === storeId);
            totalQuantity = depot ? parseFloat(depot.available || "0") : 0;
          } else {
            totalQuantity = parseFloat(product.available || "0");
          }

          console.log(`  🔄 Syncing ${mapping.shopifyProductId} (Default Location)...`);
          await shopifyProductAPI.updateVariantInventory(
            mapping.shopifyProductId,
            Math.floor(totalQuantity)
          );
        }

        console.log(`  📊 Product ${nhanhProductId} (${product.code}): ${totalQuantity} available`);

        // Update local DB
        await prisma.nhanhProduct.update({
          where: { id: nhanhProductId },
          data: {
            quantity: Math.floor(totalQuantity),
            lastPulledAt: new Date(),
          },
        });

        // Update mapping
        await prisma.productMapping.update({
          where: { id: mapping.id },
          data: {
            syncStatus: "SYNCED",
            lastSyncedAt: new Date(),
            syncError: null,
            syncAttempts: 0,
          },
        });

        // Log sync
        await prisma.productSyncLog.create({
          data: {
            mappingId: mapping.id,
            action: SyncAction.INVENTORY_UPDATE,
            status: SyncStatus.SYNCED,
            message: `Webhook: Updated inventory to ${totalQuantity}`,
            metadata: {
              source: "nhanh_webhook",
              nhanhProductId,
              shopifyProductId: mapping.shopifyProductId,
              totalQuantity,
              locationMappingsCount: locationMappings.length,
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
        console.error(`  ❌ Error processing ${product.id}:`, productError.message);
        results.failed++;
        results.details.push({
          nhanhProductId: product.id.toString(),
          nhanhSku: product.code,
          status: "failed",
          error: productError.message,
        });

        // Log error
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
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process webhook" },
      { status: 500 }
    );
  }
}
