// API Route: Sync Product from Nhanh to Shopify
// Updated to support multi-location sync with SUM logic for multiple depots
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyProductAPI } from "@/lib/shopify-product-api";
import { nhanhProductAPI } from "@/lib/nhanh-product-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappingId } = body;

    if (!mappingId) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping ID is required",
        },
        { status: 400 }
      );
    }

    // Get mapping
    const mapping = await prisma.productMapping.findUnique({
      where: { id: mappingId },
    });

    if (!mapping) {
      return NextResponse.json(
        {
          success: false,
          error: "Mapping not found",
        },
        { status: 404 }
      );
    }

    if (!mapping.shopifyProductId || !mapping.shopifyVariantId) {
      return NextResponse.json(
        {
          success: false,
          error: "Shopify product not mapped",
        },
        { status: 400 }
      );
    }

    // Update mapping status to PENDING
    await prisma.productMapping.update({
      where: { id: mappingId },
      data: {
        syncStatus: "PENDING",
        syncAttempts: { increment: 1 },
      },
    });

    try {
      // Get active location mappings
      const locationMappings = await prisma.locationMapping.findMany({
        where: { active: true },
      });

      let syncResults: { locationId: string; locationName: string; quantity: number; depots: string[] }[] = [];

      if (locationMappings.length > 0) {
        // MULTI-LOCATION SYNC with SUM logic
        // Group mappings by Shopify location (sum inventory from multiple depots → same location)
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

        console.log(`[Sync] Multi-location sync for product ${mapping.nhanhProductId} to ${locationGroups.size} Shopify location(s)...`);

        // Sync to each Shopify location (with summed inventory from multiple depots)
        for (const [shopifyLocationId, group] of locationGroups) {
          try {
            let totalQuantity = 0;
            const depotDetails: string[] = [];

            // Sum inventory from all depots mapped to this Shopify location
            for (const depot of group.depots) {
              const inventoryData = await nhanhProductAPI.getProductInventoryByDepot(
                mapping.nhanhProductId,
                depot.id
              );
              totalQuantity += inventoryData.quantity;
              depotDetails.push(`${depot.name}: ${inventoryData.quantity}`);

              console.log(`[Sync] ${mapping.nhanhProductName}: depot ${depot.name} = ${inventoryData.quantity}`);
            }

            console.log(`[Sync] ${mapping.nhanhProductName}: TOTAL for ${group.locationName} = ${totalQuantity} (${depotDetails.join(' + ')})`);

            // Update Shopify inventory at specific location with SUMMED quantity
            await shopifyProductAPI.updateVariantInventory(
              mapping.shopifyVariantId,
              totalQuantity,
              mapping.shopifyInventoryItemId || undefined,
              shopifyLocationId
            );

            syncResults.push({
              locationId: shopifyLocationId,
              locationName: group.locationName,
              quantity: totalQuantity,
              depots: depotDetails,
            });
          } catch (locError: any) {
            console.error(`[Sync] Error syncing to location ${group.locationName}:`, locError.message);
            // Continue with other locations
          }
        }
      } else {
        // SINGLE-LOCATION SYNC (fallback): Use total available or NHANH_STORE_ID
        console.log(`[Sync] Single-location sync for product ${mapping.nhanhProductId} (no location mappings)...`);

        const inventoryData = await nhanhProductAPI.getProductInventory(mapping.nhanhProductId);
        console.log(`[Sync] ${mapping.nhanhProductName}: quantity = ${inventoryData.quantity}`);

        const result = await shopifyProductAPI.updateVariantInventory(
          mapping.shopifyVariantId,
          inventoryData.quantity,
          mapping.shopifyInventoryItemId || undefined
        );

        // Cache inventoryItemId
        if (result.inventoryItemId) {
          await prisma.productMapping.update({
            where: { id: mappingId },
            data: { shopifyInventoryItemId: result.inventoryItemId },
          });
        }

        syncResults.push({
          locationId: "primary",
          locationName: "Primary Location",
          quantity: inventoryData.quantity,
          depots: ["Total Available"],
        });
      }

      // Update mapping status to SYNCED
      const updatedMapping = await prisma.productMapping.update({
        where: { id: mappingId },
        data: {
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });

      // Create sync log
      await prisma.productSyncLog.create({
        data: {
          mappingId,
          action: "MANUAL_SYNC",
          status: "SYNCED",
          message: locationMappings.length > 0
            ? `Multi-location sync to ${syncResults.length} location(s) with SUM logic`
            : "Single-location sync",
          metadata: {
            syncedAt: new Date().toISOString(),
            locations: syncResults,
            mode: locationMappings.length > 0 ? "multi-location-sum" : "single-location",
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: locationMappings.length > 0
          ? `Inventory synced to ${syncResults.length} location(s) with summed depot quantities`
          : "Inventory synced successfully",
        data: {
          ...updatedMapping,
          nhanhPrice: parseFloat(updatedMapping.nhanhPrice.toString()),
          syncResults,
        },
      });
    } catch (syncError: any) {
      console.error("Error syncing product:", syncError);

      // Update mapping status to FAILED
      await prisma.productMapping.update({
        where: { id: mappingId },
        data: {
          syncStatus: "FAILED",
          syncError: syncError.message,
        },
      });

      // Create sync log
      await prisma.productSyncLog.create({
        data: {
          mappingId,
          action: "MANUAL_SYNC",
          status: "FAILED",
          message: "Product sync failed",
          errorDetail: syncError.message,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: syncError.message || "Failed to sync product",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in sync product:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sync product",
      },
      { status: 500 }
    );
  }
}
