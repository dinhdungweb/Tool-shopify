import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyProductAPI } from "@/lib/shopify-product-api";
import { nhanhProductAPI } from "@/lib/nhanh-product-api";
import { getStoreContextOrDefault } from "@/lib/store-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/locations
 * Get all location mappings, plus available Shopify Locations and Nhanh Depots
 */
export async function GET(request: NextRequest) {
    try {
        const { storeId } = await getStoreContextOrDefault(request);

        // 1. Fetch saved mappings from DB
        const mappings = await prisma.locationMapping.findMany({
            where: { storeId },
            orderBy: { createdAt: "desc" },
        });

        // 2. Fetch fresh lists from APIs (parallel)
        let shopifyError = null;
        let nhanhError = null;

        const [shopifyLocations, nhanhDepots] = await Promise.all([
            shopifyProductAPI.getLocations().catch(e => {
                console.error("Failed to fetch Shopify locations:", e);
                shopifyError = e.message;
                return [];
            }),
            nhanhProductAPI.getDepots().catch(e => {
                console.error("Failed to fetch Nhanh depots:", e);
                nhanhError = e.message;
                return [];
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                mappings,
                shopifyLocations,
                nhanhDepots,
                errors: {
                    shopify: shopifyError,
                    nhanh: nhanhError
                }
            },
        });
    } catch (error: any) {
        console.error("Error fetching location settings:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/settings/locations
 * Create or update a location mapping
 */
export async function POST(request: NextRequest) {
    try {
        const { storeId } = await getStoreContextOrDefault(request);
        const body = await request.json();
        const { nhanhDepotId, nhanhDepotName, shopifyLocationId, shopifyLocationName, active } = body;

        if (!nhanhDepotId || !shopifyLocationId) {
            return NextResponse.json(
                { success: false, error: "Missing depot or location ID" },
                { status: 400 }
            );
        }

        // Check if mapping already exists
        const existing = await prisma.locationMapping.findUnique({
            where: {
                storeId_nhanhDepotId_shopifyLocationId: {
                    storeId,
                    nhanhDepotId: nhanhDepotId.toString(),
                    shopifyLocationId: shopifyLocationId.toString(),
                },
            },
        });

        let mapping;
        if (existing) {
            // Update
            mapping = await prisma.locationMapping.update({
                where: { id: existing.id },
                data: {
                    nhanhDepotName,
                    shopifyLocationName,
                    active: active !== undefined ? active : existing.active,
                },
            });
        } else {
            // Create
            mapping = await prisma.locationMapping.create({
                data: {
                    storeId,
                    nhanhDepotId: nhanhDepotId.toString(),
                    nhanhDepotName,
                    shopifyLocationId: shopifyLocationId.toString(),
                    shopifyLocationName,
                    active: active !== undefined ? active : true,
                },
            });
        }

        return NextResponse.json({
            success: true,
            data: mapping,
            message: "Location mapping saved successfully",
        });
    } catch (error: any) {
        console.error("Error saving location mapping:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/settings/locations
 * Delete a location mapping
 */
export async function DELETE(request: NextRequest) {
    try {
        const { storeId } = await getStoreContextOrDefault(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { success: false, error: "Missing mapping ID" },
                { status: 400 }
            );
        }

        const deleted = await prisma.locationMapping.deleteMany({
            where: { id, storeId },
        });

        if (deleted.count === 0) {
            return NextResponse.json(
                { success: false, error: "Location mapping not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Location mapping deleted successfully",
        });
    } catch (error: any) {
        console.error("Error deleting location mapping:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
