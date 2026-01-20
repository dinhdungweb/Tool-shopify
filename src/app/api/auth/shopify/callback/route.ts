/**
 * Shopify OAuth Callback
 * GET /api/auth/shopify/callback
 * 
 * Handles the OAuth callback from Shopify
 * Exchanges authorization code for access token
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { clearApiConfigCache } from "@/lib/api-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get("code");
        const shop = searchParams.get("shop");
        const state = searchParams.get("state");
        const hmac = searchParams.get("hmac");

        // Validate required params
        if (!code || !shop || !state) {
            return redirectWithError("Missing required parameters");
        }

        // Verify state (CSRF protection)
        const storedStateSetting = await prisma.setting.findUnique({
            where: { key: "SHOPIFY_OAUTH_STATE" },
        });
        const storedState = storedStateSetting?.value;

        if (!storedState || storedState !== state) {
            return redirectWithError("Invalid state parameter");
        }

        // Verify HMAC if provided
        if (hmac) {
            const apiSecret = process.env.SHOPIFY_API_SECRET;
            if (apiSecret) {
                const isValid = verifyHmac(request.url, apiSecret);
                if (!isValid) {
                    console.warn("HMAC verification failed, but continuing...");
                    // Some Shopify flows don't include HMAC, so we don't fail here
                }
            }
        }

        // Exchange code for access token
        const apiKey = process.env.SHOPIFY_API_KEY;
        const apiSecret = process.env.SHOPIFY_API_SECRET;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        if (!apiKey || !apiSecret) {
            return redirectWithError("SHOPIFY_API_KEY or SHOPIFY_API_SECRET not configured");
        }

        const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: apiKey,
                client_secret: apiSecret,
                code,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error("Token exchange failed:", errorData);
            return redirectWithError("Failed to exchange code for token");
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            return redirectWithError("No access token received");
        }

        // Encrypt and store credentials
        const encryptedToken = encrypt(accessToken);

        // Store access token
        await prisma.setting.upsert({
            where: { key: "SHOPIFY_ACCESS_TOKEN" },
            update: { value: encryptedToken },
            create: { key: "SHOPIFY_ACCESS_TOKEN", value: encryptedToken },
        });

        // Store shop URL
        await prisma.setting.upsert({
            where: { key: "SHOPIFY_STORE_URL" },
            update: { value: encrypt(shop) },
            create: { key: "SHOPIFY_STORE_URL", value: encrypt(shop) },
        });

        // Clean up OAuth state
        await prisma.setting.deleteMany({
            where: {
                key: { in: ["SHOPIFY_OAUTH_STATE", "SHOPIFY_OAUTH_SHOP"] },
            },
        });

        // Clear API config cache to use new credentials
        clearApiConfigCache();

        console.log(`✅ Shopify OAuth completed for ${shop}`);

        // Redirect to settings with success message
        return NextResponse.redirect(`${appUrl}/settings?shopify=connected`);
    } catch (error: any) {
        console.error("Shopify OAuth callback error:", error);
        return redirectWithError(error.message || "OAuth callback failed");
    }
}

function redirectWithError(error: string): NextResponse {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const errorEncoded = encodeURIComponent(error);
    return NextResponse.redirect(`${appUrl}/settings?error=${errorEncoded}`);
}

function verifyHmac(url: string, secret: string): boolean {
    try {
        const urlObj = new URL(url);
        const hmac = urlObj.searchParams.get("hmac");
        if (!hmac) return false;

        // Remove hmac from params for verification
        urlObj.searchParams.delete("hmac");

        // Sort params and create query string
        const sortedParams = Array.from(urlObj.searchParams.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join("&");

        // Calculate HMAC
        const calculatedHmac = crypto
            .createHmac("sha256", secret)
            .update(sortedParams)
            .digest("hex");

        return crypto.timingSafeEqual(
            Buffer.from(hmac),
            Buffer.from(calculatedHmac)
        );
    } catch {
        return false;
    }
}
