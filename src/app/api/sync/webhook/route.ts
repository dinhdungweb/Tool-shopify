import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";
import { nhanhAPI } from "@/lib/nhanh-api";
import { SyncStatus, SyncAction } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync/webhook
 * Handle webhook from Nhanh.vn for auto-sync
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log webhook event
    const webhookLog = await prisma.webhookLog.create({
      data: {
        source: "nhanh",
        eventType: body.event || "unknown",
        payload: body,
        processed: false,
      },
    });

    // Verify webhook signature (if provided)
    const signature = request.headers.get("x-nhanh-signature");
    if (signature) {
      const isValid = nhanhAPI.verifyWebhookSignature(
        JSON.stringify(body),
        signature
      );

      if (!isValid) {
        await prisma.webhookLog.update({
          where: { id: webhookLog.id },
          data: {
            processed: true,
            error: "Invalid webhook signature",
          },
        });

        return NextResponse.json(
          {
            success: false,
            error: "Invalid webhook signature",
          },
          { status: 401 }
        );
      }
    }

    // Process webhook based on event type
    const { event, data } = body;

    if (!event || !data || !data.customerId) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: {
          processed: true,
          error: "Invalid webhook payload",
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Invalid webhook payload",
        },
        { status: 400 }
      );
    }

    // Find mapping for this customer
    const mapping = await prisma.customerMapping.findUnique({
      where: { nhanhCustomerId: data.customerId.toString() },
    });

    if (!mapping || !mapping.shopifyCustomerId) {
      // No mapping exists, just log and return success
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: {
          processed: true,
          error: "No mapping found for this customer",
        },
      });

      return NextResponse.json({
        success: true,
        message: "No mapping found, webhook logged",
      });
    }

    // Handle different event types
    let shouldSync = false;
    let syncMessage = "";

    switch (event) {
      case "customer.updated":
        shouldSync = true;
        syncMessage = "Customer updated via webhook";
        break;

      case "order.completed":
      case "order.paid":
        shouldSync = true;
        syncMessage = "Order completed, updating total spent";
        break;

      case "customer.deleted":
        // Mark mapping as inactive or delete
        await prisma.customerMapping.update({
          where: { id: mapping.id },
          data: {
            syncStatus: SyncStatus.FAILED,
            syncError: "Customer deleted in Nhanh",
          },
        });
        shouldSync = false;
        break;

      default:
        shouldSync = false;
    }

    if (shouldSync) {
      try {
        // Get latest total spent from Nhanh
        const totalSpent = await nhanhAPI.getCustomerTotalSpent(
          mapping.nhanhCustomerId
        );

        // Update Shopify metafield
        await shopifyAPI.syncCustomerTotalSpent(
          mapping.shopifyCustomerId,
          totalSpent
        );

        // Update mapping
        await prisma.customerMapping.update({
          where: { id: mapping.id },
          data: {
            nhanhTotalSpent: totalSpent,
            syncStatus: SyncStatus.SYNCED,
            lastSyncedAt: new Date(),
            syncError: null,
            syncAttempts: { increment: 1 },
          },
        });

        // Create sync log
        await prisma.syncLog.create({
          data: {
            mappingId: mapping.id,
            action: SyncAction.WEBHOOK_SYNC,
            status: SyncStatus.SYNCED,
            message: syncMessage,
            metadata: {
              event,
              totalSpent,
              webhookData: data,
            },
          },
        });

        // Update webhook log
        await prisma.webhookLog.update({
          where: { id: webhookLog.id },
          data: {
            processed: true,
            processedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          message: "Webhook processed and customer synced",
        });
      } catch (error: any) {
        console.error("Error processing webhook:", error);

        // Update mapping with error
        await prisma.customerMapping.update({
          where: { id: mapping.id },
          data: {
            syncStatus: SyncStatus.FAILED,
            syncError: error.message,
            syncAttempts: { increment: 1 },
          },
        });

        // Create error log
        await prisma.syncLog.create({
          data: {
            mappingId: mapping.id,
            action: SyncAction.WEBHOOK_SYNC,
            status: SyncStatus.FAILED,
            message: "Webhook sync failed",
            errorDetail: error.message,
            metadata: {
              event,
              webhookData: data,
            },
          },
        });

        // Update webhook log
        await prisma.webhookLog.update({
          where: { id: webhookLog.id },
          data: {
            processed: true,
            processedAt: new Date(),
            error: error.message,
          },
        });

        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }
    }

    // Update webhook log as processed
    await prisma.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Webhook received and logged",
    });
  } catch (error: any) {
    console.error("Error handling webhook:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process webhook",
      },
      { status: 500 }
    );
  }
}
