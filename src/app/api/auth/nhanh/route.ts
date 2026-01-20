/**
 * Nhanh.vn OAuth - Initiate Authorization
 * GET /api/auth/nhanh
 * 
 * Redirects to Nhanh.vn's authorization page
 * Documentation: https://open.nhanh.vn/docs/auth/get-access-code
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const NHANH_API_VERSION = "2.0";

export async function GET(request: NextRequest) {
    try {
        // Get API credentials from environment
        const appId = process.env.NHANH_APP_ID;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        if (!appId) {
            return NextResponse.json(
                { success: false, error: "NHANH_APP_ID not configured" },
                { status: 500 }
            );
        }

        // Generate state for CSRF protection
        const state = crypto.randomBytes(16).toString("hex");

        // Store state in database for verification
        await prisma.setting.upsert({
            where: { key: "NHANH_OAUTH_STATE" },
            update: { value: state },
            create: { key: "NHANH_OAUTH_STATE", value: state },
        });

        // Build authorization URL
        // Nhanh uses returnLink as the callback URL
        // Note: returnLink must match EXACTLY with the Redirect URL registered on Nhanh
        // State is stored in DB and will be verified via a different mechanism
        const returnLink = `${appUrl}/api/auth/nhanh/callback`;

        // Nhanh OAuth URL format: https://nhanh.vn/oauth?version=3.0&appId=XXX&returnLink=YYY
        const authUrl = new URL("https://nhanh.vn/oauth");
        authUrl.searchParams.set("version", NHANH_API_VERSION);
        authUrl.searchParams.set("appId", appId);
        authUrl.searchParams.set("returnLink", returnLink);

        console.log(`🔐 Nhanh.vn OAuth: Redirecting to authorization page`);

        return NextResponse.redirect(authUrl.toString());
    } catch (error: any) {
        console.error("Nhanh OAuth error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to initiate OAuth" },
            { status: 500 }
        );
    }
}
