/**
 * Shopify OAuth - Initiate Authorization
 * GET /api/auth/shopify?shop=your-store.myshopify.com
 * 
 * Redirects to Shopify's authorization page
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Required scopes for our app
const SCOPES = [
    "read_customers",
    "write_customers",
    "read_products",
    "write_products",
    "read_inventory",
    "write_inventory",
    "read_orders",
].join(",");

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const shop = searchParams.get("shop");

        if (!shop) {
            return NextResponse.json(
                { success: false, error: "Shop parameter is required" },
                { status: 400 }
            );
        }

        // Validate shop format
        const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
        if (!shopRegex.test(shop)) {
            return NextResponse.json(
                { success: false, error: "Invalid shop format. Use: your-store.myshopify.com" },
                { status: 400 }
            );
        }

        // Get API credentials from environment
        const apiKey = process.env.SHOPIFY_API_KEY;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: "SHOPIFY_API_KEY not configured" },
                { status: 500 }
            );
        }

        // Generate state for CSRF protection
        const state = crypto.randomBytes(16).toString("hex");

        // Store state in database for verification
        await prisma.setting.upsert({
            where: { key: "SHOPIFY_OAUTH_STATE" },
            update: { value: state },
            create: { key: "SHOPIFY_OAUTH_STATE", value: state },
        });

        // Store shop for callback verification
        await prisma.setting.upsert({
            where: { key: "SHOPIFY_OAUTH_SHOP" },
            update: { value: shop },
            create: { key: "SHOPIFY_OAUTH_SHOP", value: shop },
        });

        // Build authorization URL
        const redirectUri = `${appUrl}/api/auth/shopify/callback`;
        const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
        authUrl.searchParams.set("client_id", apiKey);
        authUrl.searchParams.set("scope", SCOPES);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("state", state);

        console.log(`🔐 Shopify OAuth: Redirecting to ${shop} authorization`);

        return NextResponse.redirect(authUrl.toString());
    } catch (error: any) {
        console.error("Shopify OAuth error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to initiate OAuth" },
            { status: 500 }
        );
    }
}
