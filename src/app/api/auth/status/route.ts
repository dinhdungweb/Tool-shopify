/**
 * OAuth Connection Status API
 * GET /api/auth/status - Get connection status for Shopify and Nhanh
 * DELETE /api/auth/status?provider=shopify|nhanh - Disconnect a provider
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearApiConfigCache } from "@/lib/api-config";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // Check Shopify connection
        const shopifyToken = await prisma.setting.findUnique({
            where: { key: "SHOPIFY_ACCESS_TOKEN" },
        });
        const shopifyStore = await prisma.setting.findUnique({
            where: { key: "SHOPIFY_STORE_URL" },
        });

        // Check Nhanh connection
        const nhanhToken = await prisma.setting.findUnique({
            where: { key: "NHANH_ACCESS_TOKEN" },
        });
        const nhanhBusinessId = await prisma.setting.findUnique({
            where: { key: "NHANH_BUSINESS_ID" },
        });

        return NextResponse.json({
            success: true,
            data: {
                shopify: {
                    connected: !!(shopifyToken?.value && shopifyStore?.value),
                    hasToken: !!shopifyToken?.value,
                    hasStore: !!shopifyStore?.value,
                },
                nhanh: {
                    connected: !!(nhanhToken?.value && nhanhBusinessId?.value),
                    hasToken: !!nhanhToken?.value,
                    hasBusinessId: !!nhanhBusinessId?.value,
                },
            },
        });
    } catch (error: any) {
        console.error("Error getting auth status:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to get status" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const provider = searchParams.get("provider");

        if (!provider || !["shopify", "nhanh"].includes(provider)) {
            return NextResponse.json(
                { success: false, error: "Invalid provider. Use 'shopify' or 'nhanh'" },
                { status: 400 }
            );
        }

        if (provider === "shopify") {
            // Delete Shopify credentials
            await prisma.setting.deleteMany({
                where: {
                    key: { in: ["SHOPIFY_ACCESS_TOKEN", "SHOPIFY_STORE_URL"] },
                },
            });
            console.log("🔓 Shopify disconnected");
        } else if (provider === "nhanh") {
            // Delete Nhanh credentials
            await prisma.setting.deleteMany({
                where: {
                    key: {
                        in: [
                            "NHANH_ACCESS_TOKEN",
                            "NHANH_BUSINESS_ID",
                            "NHANH_APP_ID",
                            "NHANH_API_URL",
                        ],
                    },
                },
            });
            console.log("🔓 Nhanh.vn disconnected");
        }

        // Clear API config cache
        clearApiConfigCache();

        return NextResponse.json({
            success: true,
            message: `${provider} disconnected successfully`,
        });
    } catch (error: any) {
        console.error("Error disconnecting provider:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to disconnect" },
            { status: 500 }
        );
    }
}
