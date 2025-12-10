import { NextRequest, NextResponse } from "next/server";
import { handleInventoryWebhook } from "./handlers/inventory";
import { handleCustomerWebhook } from "./handlers/customer";
import { handleOrderWebhook } from "./handlers/order";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/webhooks/nhanh
 * Main webhook endpoint - routes events to appropriate handlers
 */
export async function POST(request: NextRequest) {
  try {
    // Security: Verify webhook token (optional but recommended)
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.NHANH_WEBHOOK_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.error("❌ Invalid webhook token");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    const event = payload.event;
    console.log(`📨 Received Nhanh webhook: ${event} ${expectedToken ? "(verified)" : ""}`);

    // Handle webhooksEnabled test
    if (event === "webhooksEnabled") {
      console.log("✅ webhooksEnabled test received");
      return NextResponse.json({
        success: true,
        message: "Webhook is enabled and ready",
        endpoint: "/api/webhooks/nhanh",
        supportedEvents: [
          "inventoryChange",
          "customerUpdate",
          "orderAdd",
          "orderUpdate",
          "productAdd",
          "productUpdate",
        ],
      });
    }

    // Route to appropriate handler
    switch (event) {
      case "inventoryChange":
        return handleInventoryChange(request, payload);

      case "customerUpdate":
        return handleCustomerUpdate(request, payload);

      case "orderAdd":
      case "orderUpdate":
        return handleOrderEvent(request, payload);

      case "productAdd":
      case "productUpdate":
        return handleProductEvent(request, payload);

      default:
        console.log(`⚠️ Unhandled event: ${event}`);
        return NextResponse.json({
          success: true,
          message: `Event ${event} received but not handled`,
        });
    }
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/nhanh
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Nhanh webhook endpoint is ready",
    endpoint: "/api/webhooks/nhanh",
    supportedEvents: [
      "inventoryChange",
      "customerUpdate",
      "orderAdd",
      "orderUpdate",
      "productAdd",
      "productUpdate",
    ],
  });
}

// Handler functions - direct execution (no forwarding)
async function handleInventoryChange(_request: NextRequest, payload: any) {
  return handleInventoryWebhook(payload);
}

async function handleCustomerUpdate(_request: NextRequest, payload: any) {
  return handleCustomerWebhook(payload);
}

async function handleOrderEvent(_request: NextRequest, payload: any) {
  return handleOrderWebhook(payload);
}

async function handleProductEvent(_request: NextRequest, payload: any) {
  // TODO: Implement product sync
  console.log(`🏷️ Product event: ${payload.event}`);
  return NextResponse.json({
    success: true,
    message: "Product event received (not implemented yet)",
  });
}
