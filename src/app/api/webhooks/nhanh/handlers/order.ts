import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nhanhAPI } from "@/lib/nhanh-api";
import { shopifyAPI } from "@/lib/shopify-api";

/**
 * Handle order webhook from Nhanh.vn (orderAdd, orderUpdate)
 * When an order is created/updated, we fetch the customer's latest totalSpent
 * and sync it to Shopify
 */
export async function handleOrderWebhook(payload: any) {
    const startTime = Date.now();

    try {
        const event = payload.event;
        const orderData = payload.data;

        console.log(`📦 Processing order webhook: ${event}`);

        // Extract customer ID from order data
        // Based on Nhanh API docs: data.shippingAddress.id is the customer ID
        const customerId = orderData?.shippingAddress?.id?.toString();

        if (!customerId) {
            console.log("⚠️ No customer ID in order payload, skipping sync");

            // Log webhook for debugging
            await prisma.webhookLog.create({
                data: {
                    source: "nhanh",
                    eventType: event,
                    payload: payload,
                    processed: true,
                    error: "No customer ID found in order",
                },
            });

            return NextResponse.json({
                success: true,
                message: "Order received but no customer ID to sync",
                event,
            });
        }

        console.log(`👤 Customer ID from order: ${customerId}`);

        // Find mapping for this customer
        const mapping = await prisma.customerMapping.findUnique({
            where: { nhanhCustomerId: customerId },
        });

        if (!mapping || !mapping.shopifyCustomerId) {
            console.log(`⏭️ Skipped: No mapping for Nhanh customer ${customerId}`);

            // Log webhook
            await prisma.webhookLog.create({
                data: {
                    source: "nhanh",
                    eventType: event,
                    payload: payload,
                    processed: true,
                    error: `No mapping found for customer ${customerId}`,
                },
            });

            return NextResponse.json({
                success: true,
                message: `Order received but customer ${customerId} not mapped`,
                event,
                customerId,
            });
        }

        // Fetch latest totalSpent from Nhanh API
        console.log(`💰 Fetching totalSpent for customer ${customerId}...`);
        const totalSpent = await nhanhAPI.getCustomerTotalSpent(customerId);
        console.log(`💰 Customer ${customerId} totalSpent: ${totalSpent}`);

        // Update local DB
        try {
            await prisma.nhanhCustomer.update({
                where: { id: customerId },
                data: {
                    totalSpent,
                    lastPulledAt: new Date(),
                },
            });
        } catch (dbError) {
            // Customer might not exist in NhanhCustomer table, that's ok
            console.log(`Note: Could not update NhanhCustomer table (customer may not exist there)`);
        }

        // Sync to Shopify
        console.log(`🔄 Syncing to Shopify customer ${mapping.shopifyCustomerId}...`);

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

        // Log successful sync
        await prisma.syncLog.create({
            data: {
                mappingId: mapping.id,
                action: "WEBHOOK_SYNC",
                status: "SYNCED",
                message: `Order webhook: Updated totalSpent to ${totalSpent}`,
                metadata: {
                    source: "nhanh_order_webhook",
                    event,
                    nhanhCustomerId: customerId,
                    shopifyCustomerId: mapping.shopifyCustomerId,
                    totalSpent,
                },
            },
        });

        // Log webhook
        await prisma.webhookLog.create({
            data: {
                source: "nhanh",
                eventType: event,
                payload: payload,
                processed: true,
            },
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Order webhook processed in ${duration}s - synced customer ${customerId}`);

        return NextResponse.json({
            success: true,
            message: `Order ${event}: synced customer ${customerId} totalSpent = ${totalSpent}`,
            data: {
                event,
                customerId,
                shopifyCustomerId: mapping.shopifyCustomerId,
                totalSpent,
            },
            duration: `${duration}s`,
        });

    } catch (error: any) {
        console.error("❌ Order webhook error:", error);

        // Log error
        try {
            await prisma.webhookLog.create({
                data: {
                    source: "nhanh",
                    eventType: payload.event || "unknown",
                    payload: payload,
                    processed: false,
                    error: error.message,
                },
            });
        } catch (logError) {
            console.error("Failed to log webhook error:", logError);
        }

        return NextResponse.json(
            { success: false, error: error.message || "Failed to process order webhook" },
            { status: 500 }
        );
    }
}
