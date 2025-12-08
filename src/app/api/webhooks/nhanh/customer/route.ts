import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/webhooks/nhanh/customer
 * Webhook endpoint to receive customer totalSpent changes from Nhanh.vn
 * Automatically syncs totalSpent to Shopify for mapped customers
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse webhook payload
    const text = await request.text();
    let payload: any = {};
    
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (e) {
        console.error("Invalid JSON payload");
        return NextResponse.json(
          { success: false, error: "Invalid JSON" },
          { status: 400 }
        );
      }
    }
    
    console.log("👤 Received Nhanh customer webhook:", {
      event: payload.event,
      businessId: payload.businessId,
      customersCount: payload.data?.length || 0,
    });

    // Handle webhooksEnabled test from Nhanh.vn
    if (payload.event === "webhooksEnabled") {
      console.log("✅ webhooksEnabled test received from Nhanh.vn");
      return NextResponse.json({
        success: true,
        message: "Webhook is enabled and ready",
        endpoint: "/api/webhooks/nhanh/customer",
      });
    }

    // Handle empty or test webhook
    if (!payload.event) {
      console.log("✅ Test webhook received (no event)");
      return NextResponse.json({
        success: true,
        message: "Webhook endpoint is ready",
        endpoint: "/api/webhooks/nhanh/customer",
      });
    }

    // Validate webhook
    if (payload.event !== "customerUpdate") {
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

        // Find mapping for this Nhanh customer
        const mapping = await prisma.customerMapping.findUnique({
          where: { nhanhCustomerId },
        });

        if (!mapping || !mapping.shopifyCustomerId) {
          console.log(`  ⏭️  Skipped: No mapping found for customer ${nhanhCustomerId}`);
          results.skipped++;
          results.details.push({
            nhanhCustomerId,
            status: "skipped",
            reason: "No mapping found",
          });
          continue;
        }

        // Update Nhanh customer totalSpent in local database
        await prisma.nhanhCustomer.update({
          where: { id: nhanhCustomerId },
          data: {
            totalSpent,
            lastPulledAt: new Date(),
          },
        });

        // Sync to Shopify using metafield
        console.log(`  🔄 Syncing to Shopify customer ${mapping.shopifyCustomerId}...`);
        
        // Handle shopifyCustomerId - it might already have the gid prefix
        const shopifyGid = mapping.shopifyCustomerId.startsWith('gid://')
          ? mapping.shopifyCustomerId
          : `gid://shopify/Customer/${mapping.shopifyCustomerId}`;
        
        await shopifyAPI.syncCustomerTotalSpent(
          shopifyGid,
          totalSpent
        );

        // Update mapping status
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
        console.error(`  ❌ Error processing customer ${customer.id}:`, customerError.message);
        
        results.failed++;
        results.details.push({
          nhanhCustomerId: customer.id.toString(),
          status: "failed",
          error: customerError.message,
        });

        // Try to log error if mapping exists
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
    
    // Log webhook error
    try {
      const body = await request.clone().text();
      await prisma.webhookLog.create({
        data: {
          source: "nhanh",
          eventType: "customerUpdate",
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
 * GET /api/webhooks/nhanh/customer
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Nhanh customer webhook endpoint is ready",
    endpoint: "/api/webhooks/nhanh/customer",
    method: "POST",
    event: "customerUpdate",
    syncs: ["totalSpent"],
  });
}
