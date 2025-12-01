// API Route: Get and Update Settings (with encryption)
import { NextResponse } from "next/server";
import { getApiCredentials, updateApiCredentials, hasSettingsInDatabase } from "@/lib/settings";
import { clearApiConfigCache } from "@/lib/api-config";

export const dynamic = "force-dynamic";

// Mask sensitive data for display
const maskToken = (token: string | null) => {
  if (!token) return "";
  if (token.length <= 8) return "•".repeat(token.length);
  return token.substring(0, 4) + "•".repeat(token.length - 8) + token.substring(token.length - 4);
};

export async function GET() {
  try {
    // Get credentials from database (or fallback to .env)
    const credentials = await getApiCredentials();
    const hasDbSettings = await hasSettingsInDatabase();

    const settings = {
      shopify: {
        storeUrl: credentials.shopify.storeUrl || "",
        accessToken: maskToken(credentials.shopify.accessToken),
      },
      nhanh: {
        apiUrl: credentials.nhanh.apiUrl || "",
        appId: credentials.nhanh.appId || "",
        businessId: credentials.nhanh.businessId || "",
        accessToken: maskToken(credentials.nhanh.accessToken),
      },
      source: hasDbSettings ? "database" : "environment",
    };

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    console.error("Error getting settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shopify, nhanh } = body;

    // Validate input
    if (!shopify && !nhanh) {
      return NextResponse.json(
        {
          success: false,
          error: "No settings provided",
        },
        { status: 400 }
      );
    }

    // Update credentials (will be encrypted before saving)
    await updateApiCredentials({
      shopify: shopify
        ? {
            storeUrl: shopify.storeUrl,
            accessToken: shopify.accessToken,
          }
        : undefined,
      nhanh: nhanh
        ? {
            apiUrl: nhanh.apiUrl,
            appId: nhanh.appId,
            businessId: nhanh.businessId,
            accessToken: nhanh.accessToken,
          }
        : undefined,
    });

    // Clear API config cache so new settings take effect immediately
    clearApiConfigCache();

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
