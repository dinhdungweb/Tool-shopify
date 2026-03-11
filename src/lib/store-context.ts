/**
 * Store Context Helper
 * Provides utilities to get the current store context from request/session.
 * All multi-tenant API routes use this to scope data by storeId.
 */

import { NextRequest } from "next/server";
import { prisma } from "./prisma";

export interface StoreContext {
    storeId: string;
    orgId: string;
    userId: string;
}

/**
 * Get store context from request.
 * Priority: X-Store-Id header > active_store cookie > user's activeStoreId
 */
export async function getStoreContext(request?: NextRequest): Promise<StoreContext | null> {
    try {
        // 1. Try to get storeId from header
        let storeId = request?.headers.get("x-store-id") || null;

        // 2. Try cookie
        if (!storeId) {
            storeId = request?.cookies.get("active_store")?.value || null;
        }

        // 3. Try session user's activeStoreId
        if (!storeId) {
            const sessionToken = request?.cookies.get("session_token")?.value;
            if (sessionToken) {
                const session = await prisma.session.findUnique({
                    where: { token: sessionToken },
                    include: { user: true },
                });
                if (session?.user?.activeStoreId) {
                    storeId = session.user.activeStoreId;
                }
            }
        }

        // 4. Fallback: get first store user has access to
        if (!storeId) {
            const sessionToken = request?.cookies.get("session_token")?.value;
            if (sessionToken) {
                const session = await prisma.session.findUnique({
                    where: { token: sessionToken },
                    include: {
                        user: {
                            include: {
                                members: {
                                    include: {
                                        org: {
                                            include: {
                                                stores: { where: { active: true }, take: 1 },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                });

                const firstStore = session?.user?.members?.[0]?.org?.stores?.[0];
                if (firstStore) {
                    storeId = firstStore.id;
                    // Update user's activeStoreId
                    await prisma.user.update({
                        where: { id: session!.user.id },
                        data: { activeStoreId: storeId },
                    });
                }
            }
        }

        if (!storeId) return null;

        // Verify store exists and get orgId
        const store = await prisma.storeConnection.findUnique({
            where: { id: storeId },
            select: { id: true, orgId: true },
        });

        if (!store) return null;

        // Get userId from session
        const sessionToken = request?.cookies.get("session_token")?.value;
        let userId = "";
        if (sessionToken) {
            const session = await prisma.session.findUnique({
                where: { token: sessionToken },
                select: { userId: true },
            });
            userId = session?.userId || "";
        }

        return {
            storeId: store.id,
            orgId: store.orgId,
            userId,
        };
    } catch (error) {
        console.error("Error getting store context:", error);
        return null;
    }
}

/**
 * Get store context or return default store (for backward compatibility)
 * Used during the transition period
 */
export async function getStoreContextOrDefault(request?: NextRequest): Promise<StoreContext> {
    const context = await getStoreContext(request);
    if (context) return context;

    // Return default store for backward compatibility
    return {
        storeId: "default_store",
        orgId: "default_org",
        userId: "",
    };
}

/**
 * Get store config (Shopify + Nhanh credentials) for a specific store
 */
export async function getStoreConfig(storeId: string) {
    const store = await prisma.storeConnection.findUnique({
        where: { id: storeId },
    });

    if (!store) {
        throw new Error(`Store not found: ${storeId}`);
    }

    return {
        shopify: {
            storeUrl: store.shopifyStoreUrl,
            accessToken: store.shopifyAccessToken,
            apiVersion: "2024-01",
        },
        nhanh: {
            apiUrl: store.nhanhApiUrl,
            appId: store.nhanhAppId,
            businessId: store.nhanhBusinessId,
            accessToken: store.nhanhAccessToken,
        },
    };
}

/**
 * Resolve storeId from webhook secret
 */
export async function getStoreByWebhookSecret(secret: string): Promise<string | null> {
    const store = await prisma.storeConnection.findUnique({
        where: { webhookSecret: secret },
        select: { id: true },
    });
    return store?.id || null;
}
