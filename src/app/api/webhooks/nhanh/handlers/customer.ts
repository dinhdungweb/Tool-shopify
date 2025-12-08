import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";

/**
 * Handle customer update webhook
 * Shared logic used by both router and direct endpoint
 */
export async function handleCustomerWebhook(payload: any) {
  const startTime = Date.now();

  try {
    // Validate payload
    if (!payload.data || !Array.isArray(payload.data)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload data" },
        { status: 400 }
      );
    }

    console.log("👤 Processing customer webhook:", {
      event: payload.event,
      businessId: payload.businessId,
      customersCount: payload.data.length,
    });

    // Process customer changes
    const results = {
      total: payload.data.length,
      synced: 0,
      skipped: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const customer of payload.data) {
      try {
        const nhanhCustomerId = customer.id.toString();
        const totalSpent = parseFloat(customer.totalSpent || "0");

        console.log(`  💰 Customer ${nhanhCustomerId}: totalSpent = ${totalSpent}`);

        // Find mapping
        const mapping = await prisma.customerMapping.findUnique({
          where: { nhanhCustomerId },
        });

        if (!mapping || !mapping.shopifyCustomerId) {
          console.log(`  ⏭️  Skipped: No mapping for ${nhanhCustomerId}`);
          results.skipped++;
          results.details.push({
            nhanhCustomerId,
            status: "skipped",
            reason: "No mapping found",
          });
          continue;
        }

        // Update local DB
        await prisma.nhanhCustomer.update({
          where: { id: nhanhCustomerId },
          data: {
            totalSpent,
            lastPulledAt: new Date(),
          },
        });

        // Sync to Shopify
        console.log(`  🔄 Syncing to Shopify customer ${mapping.shopifyCustomerId}...`);

        const shopifyGid = mapping.shopifyCustomerId.startsWith("gid://")
          ? mapping.shopifyCustomerId
          : `gid://shopify/Customer/${mapping.shopifyCustomerId}`;

        await shopifyAPI.syncCustomerTotalSpent(shopifyGid, totalSpent);

        // Update mapping
        await prisma.customerMapping.update({
          where: { id: mapping.id },
          data: {
            syncStatus: "SYNCED",
            lastSyncedAt: new Date(),
            syncError: null,
            syncAttempts: 0,
            nhanhTotalSpent: totalSpent,
          },
        });

        // Log sync
        await prisma.syncLog.create({
          data: {
            mappingId: mapping.id,
            action: "WEBHOOK_SYNC",
            status: "SYNCED",
            message: `Webhook: Updated totalSpent to ${totalSpent}`,
            metadata: {
              source: "nhanh_webhook",
              nhanhCustomerId,
              shopifyCustomerId: mapping.shopifyCustomerId,
              totalSpent,
            },
          },
        });

        results.synced++;
        results.details.push({
          nhanhCustomerId,
          shopifyCustomerId: mapping.shopifyCustomerId,
          totalSpent,
          status: "synced",
        });

        console.log(`  ✅ Synced successfully`);

      } catch (customerError: any) {
        console.error(`  ❌ Error processing ${customer.id}:`, customerError.message);
        results.failed++;
        results.details.push({
          nhanhCustomerId: customer.id.toString(),
          status: "failed",
          error: customerError.message,
        });

        // Log error
        try {
          const mapping = await prisma.customerMapping.findUnique({
            where: { nhanhCustomerId: customer.id.toString() },
          });

          if (mapping) {
            await prisma.customerMapping.update({
              where: { id: mapping.id },
              data: {
                syncStatus: "FAILED",
                syncError: customerError.message,
                syncAttempts: { increment: 1 },
              },
            });

            await prisma.syncLog.create({
              data: {
                mappingId: mapping.id,
                action: "WEBHOOK_SYNC",
                status: "FAILED",
                message: `Webhook: Failed to update totalSpent`,
                errorDetail: customerError.message,
                metadata: {
                  source: "nhanh_webhook",
                  nhanhCustomerId: customer.id.toString(),
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
      message: `Processed ${results.total} customers: ${results.synced} synced, ${results.skipped} skipped, ${results.failed} failed`,
    });

  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process webhook" },
      { status: 500 }
    );
  }
}
