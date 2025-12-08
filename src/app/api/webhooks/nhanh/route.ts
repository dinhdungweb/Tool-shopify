import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/webhooks/nhanh
 * Main webhook endpoint - routes events to appropriate handlers
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

    const event = payload.event;
    console.log(`📨 Received Nhanh webhook: ${event}`);

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

// Handler functions - delegate to existing endpoints
async function handleInventoryChange(request: NextRequest, payload: any) {
  // Forward to inventory webhook
  const url = new URL("/api/webhooks/nhanh/inventory", request.url);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(res => res.json()).then(data => NextResponse.json(data));
}

async function handleCustomerUpdate(request: NextRequest, payload: any) {
  // Forward to customer webhook
  const url = new URL("/api/webhooks/nhanh/customer", request.url);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(res => res.json()).then(data => NextResponse.json(data));
}

async function handleOrderEvent(request: NextRequest, payload: any) {
  // TODO: Implement order sync
  console.log(`📦 Order event: ${payload.event}`);
  return NextResponse.json({
    success: true,
    message: "Order event received (not implemented yet)",
  });
}

async function handleProductEvent(request: NextRequest, payload: any) {
  // TODO: Implement product sync
  console.log(`🏷️ Product event: ${payload.event}`);
  return NextResponse.json({
    success: true,
    message: "Product event received (not implemented yet)",
  });
}
