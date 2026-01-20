/**
 * Nhanh.vn OAuth Callback
 * GET /api/auth/nhanh/callback
 * 
 * Handles the OAuth callback from Nhanh.vn
 * Exchanges accessCode for accessToken
 * Documentation: https://open.nhanh.vn/docs/auth/get-access-token
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { clearApiConfigCache } from "@/lib/api-config";

export const dynamic = "force-dynamic";

const NHANH_API_VERSION = "3.0";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const accessCode = searchParams.get("accessCode");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        // Check for error from Nhanh
        if (error) {
            return redirectWithError(`Nhanh authorization denied: ${error}`);
        }

        // Validate required params
        if (!accessCode) {
            return redirectWithError("Missing accessCode parameter");
        }

        // Verify state (CSRF protection)
        if (state) {
            const storedStateSetting = await prisma.setting.findUnique({
                where: { key: "NHANH_OAUTH_STATE" },
            });
            const storedState = storedStateSetting?.value;

            if (!storedState || storedState !== state) {
                return redirectWithError("Invalid state parameter");
            }
        }

        // Get API credentials
        const appId = process.env.NHANH_APP_ID;

        if (!appId) {
            return redirectWithError("NHANH_APP_ID not configured");
        }

        // Exchange accessCode for accessToken using Nhanh API
        // v2.0: POST to https://pos.open.nhanh.vn/api/oauth/access_token
        // Requires: version, appId, accessCode, secretKey
        const secretKey = process.env.NHANH_SECRET_KEY;

        if (!secretKey) {
            console.error("NHANH_SECRET_KEY not configured");
            return redirectWithError("NHANH_SECRET_KEY not configured");
        }

        console.log(`Exchanging accessCode for token with appId: ${appId}`);

        const tokenResponse = await fetch("https://pos.open.nhanh.vn/api/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                version: NHANH_API_VERSION,
                appId: appId,
                accessCode: accessCode,
                secretKey: secretKey,
            }),
        });

        // Get response as text first to handle HTML error pages
        const responseText = await tokenResponse.text();
        console.log("Nhanh token response:", responseText.substring(0, 500));

        // Check if response is HTML (error page)
        if (responseText.startsWith("<!DOCTYPE") || responseText.startsWith("<html")) {
            console.error("Nhanh API returned HTML instead of JSON");
            return redirectWithError("Nhanh API hiện không khả dụng, vui lòng thử lại sau");
        }

        // Parse JSON
        let tokenData;
        try {
            tokenData = JSON.parse(responseText);
        } catch (parseError) {
            console.error("Failed to parse Nhanh response:", responseText.substring(0, 200));
            return redirectWithError("Invalid response from Nhanh API");
        }

        if (tokenData.code !== 1) {
            console.error("Nhanh token exchange failed:", tokenData);
            return redirectWithError(tokenData.messages || tokenData.errorCode || "Failed to exchange accessCode");
        }

        // Extract token data
        // Nhanh response format: { code: 1, data: { accessToken, businessId, ... } }
        const { accessToken, businessId } = tokenData.data || {};

        if (!accessToken) {
            return redirectWithError("No accessToken received from Nhanh");
        }

        // Encrypt and store credentials
        await prisma.setting.upsert({
            where: { key: "NHANH_ACCESS_TOKEN" },
            update: { value: encrypt(accessToken) },
            create: { key: "NHANH_ACCESS_TOKEN", value: encrypt(accessToken) },
        });

        if (businessId) {
            await prisma.setting.upsert({
                where: { key: "NHANH_BUSINESS_ID" },
                update: { value: encrypt(businessId.toString()) },
                create: { key: "NHANH_BUSINESS_ID", value: encrypt(businessId.toString()) },
            });
        }

        // Store App ID (not encrypted as it's not sensitive)
        await prisma.setting.upsert({
            where: { key: "NHANH_APP_ID" },
            update: { value: encrypt(appId) },
            create: { key: "NHANH_APP_ID", value: encrypt(appId) },
        });

        // Store API URL
        await prisma.setting.upsert({
            where: { key: "NHANH_API_URL" },
            update: { value: encrypt("https://pos.open.nhanh.vn") },
            create: { key: "NHANH_API_URL", value: encrypt("https://pos.open.nhanh.vn") },
        });

        // Clean up OAuth state
        await prisma.setting.delete({
            where: { key: "NHANH_OAUTH_STATE" },
        }).catch(() => { }); // Ignore if not exists

        // Clear API config cache to use new credentials
        clearApiConfigCache();

        console.log(`✅ Nhanh.vn OAuth completed for businessId: ${businessId}`);

        // Redirect to settings with success message
        return NextResponse.redirect(`${appUrl}/settings?nhanh=connected`);
    } catch (error: any) {
        console.error("Nhanh OAuth callback error:", error);
        return redirectWithError(error.message || "OAuth callback failed");
    }
}

function redirectWithError(error: string): NextResponse {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const errorEncoded = encodeURIComponent(error);
    return NextResponse.redirect(`${appUrl}/settings?error=${errorEncoded}`);
}
