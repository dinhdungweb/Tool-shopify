import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleInventoryWebhook } from "../handlers/inventory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/webhooks/nhanh/inventory
 * Webhook endpoint to receive inventory changes from Nhanh.vn
 * Automatically syncs inventory to Shopify for mapped products
 */
export async function POST(request: NextRequest) {
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

    console.log("📦 Received Nhanh inventory webhook:", {
      event: payload.event,
      businessId: payload.businessId,
      productsCount: payload.data?.length || 0,
    });

    // Handle webhooksEnabled test from Nhanh.vn
    if (payload.event === "webhooksEnabled") {
      console.log("✅ webhooksEnabled test received from Nhanh.vn");
      return NextResponse.json({
        success: true,
        message: "Webhook is enabled and ready",
        endpoint: "/api/webhooks/nhanh/inventory",
      });
    }

    // Handle empty or test webhook
    if (!payload.event) {
      console.log("✅ Test webhook received (no event)");
      return NextResponse.json({
        success: true,
        message: "Webhook endpoint is ready",
        endpoint: "/api/webhooks/nhanh/inventory",
      });
    }

    // Validate webhook - only handle inventory events
    if (payload.event !== "inventoryChange") {
      console.log(`⚠️ Ignoring non-inventory event: ${payload.event}`);
      return NextResponse.json({
        success: true,
        message: `Event ${payload.event} not handled by this endpoint`,
        note: "This endpoint only handles inventoryChange events",
      });
    }

    // Use shared handler
    return handleInventoryWebhook(payload);

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
