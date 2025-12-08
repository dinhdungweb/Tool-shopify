import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleCustomerWebhook } from "../handlers/customer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/webhooks/nhanh/customer
 * Webhook endpoint to receive customer totalSpent changes from Nhanh.vn
 * Automatically syncs totalSpent to Shopify for mapped customers
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

    // Use shared handler
    return handleCustomerWebhook(payload);

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
