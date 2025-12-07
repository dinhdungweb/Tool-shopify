// API Route: Pending Approvals - List and manage items requiring approval
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// Note: Run `npx prisma generate` if IDE shows type errors for new enums

export const dynamic = "force-dynamic";

// GET: List pending approvals
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type") || "all"; // "product" | "customer" | "all"
        const limit = parseInt(searchParams.get("limit") || "50");

        const results: any = {
            products: [],
            customers: [],
        };

        // Get pending products
        if (type === "all" || type === "product") {
            results.products = await prisma.productMapping.findMany({
                where: { syncStatus: "PENDING_APPROVAL" as any },
                orderBy: { updatedAt: "desc" },
                take: limit,
                select: {
                    id: true,
                    nhanhProductId: true,
                    nhanhProductName: true,
                    nhanhSku: true,
                    nhanhPrice: true,
                    shopifyProductTitle: true,
                    shopifySku: true,
                    syncError: true,
                    updatedAt: true,
                },
            });
        }

        // Get pending customers
        if (type === "all" || type === "customer") {
            results.customers = await prisma.customerMapping.findMany({
                where: { syncStatus: "PENDING_APPROVAL" as any },
                orderBy: { updatedAt: "desc" },
                take: limit,
                select: {
                    id: true,
                    nhanhCustomerId: true,
                    nhanhCustomerName: true,
                    nhanhCustomerPhone: true,
                    nhanhCustomerEmail: true,
                    shopifyCustomerName: true,
                    shopifyCustomerEmail: true,
                    syncError: true,
                    updatedAt: true,
                },
            });
        }

        return NextResponse.json({
            success: true,
            data: results,
            counts: {
                products: results.products.length,
                customers: results.customers.length,
                total: results.products.length + results.customers.length,
            },
        });
    } catch (error: any) {
        console.error("Error fetching pending approvals:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST: Approve or reject pending items
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ids, type, action } = body; // type: "product" | "customer", action: "approve" | "reject"

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                { success: false, error: "IDs are required" },
                { status: 400 }
            );
        }

        if (!["product", "customer"].includes(type)) {
            return NextResponse.json(
                { success: false, error: "Type must be 'product' or 'customer'" },
                { status: 400 }
            );
        }

        if (!["approve", "reject"].includes(action)) {
            return NextResponse.json(
                { success: false, error: "Action must be 'approve' or 'reject'" },
                { status: 400 }
            );
        }

        const newStatus = (action === "approve" ? "PENDING" : "FAILED") as any;
        let updated = 0;

        if (type === "product") {
            const result = await prisma.productMapping.updateMany({
                where: {
                    id: { in: ids },
                    syncStatus: "PENDING_APPROVAL" as any,
                },
                data: {
                    syncStatus: newStatus,
                    syncError: action === "reject" ? "Rejected by user" : null,
                },
            });
            updated = result.count;

            // If approved, trigger sync for each
            if (action === "approve") {
                // Sync will happen in background or via bulk sync
                console.log(`[Approval] ${updated} products approved for sync`);
            }
        } else {
            const result = await prisma.customerMapping.updateMany({
                where: {
                    id: { in: ids },
                    syncStatus: "PENDING_APPROVAL" as any,
                },
                data: {
                    syncStatus: newStatus,
                    syncError: action === "reject" ? "Rejected by user" : null,
                },
            });
            updated = result.count;
        }

        return NextResponse.json({
            success: true,
            message: action === "approve"
                ? `${updated} items approved and ready for sync`
                : `${updated} items rejected`,
            updated,
        });
    } catch (error: any) {
        console.error("Error processing approval:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
