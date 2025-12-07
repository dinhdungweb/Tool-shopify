// API Route: Sync Rules CRUD
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RuleTargetType } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET: List all rules
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const targetType = searchParams.get("targetType");
        const enabledOnly = searchParams.get("enabled") === "true";

        const where: any = {};
        if (targetType && ["PRODUCT", "CUSTOMER", "ALL"].includes(targetType)) {
            where.targetType = targetType as RuleTargetType;
        }
        if (enabledOnly) {
            where.enabled = true;
        }

        const rules = await prisma.syncRule.findMany({
            where,
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
            include: {
                _count: {
                    select: { logs: true },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: rules,
            total: rules.length,
        });
    } catch (error: any) {
        console.error("Error fetching rules:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST: Create new rule
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            description,
            enabled = true,
            priority = 0,
            targetType = "PRODUCT",
            conditions,
            conditionOperator = "AND",
            actions,
        } = body;

        // Validation
        if (!name || !name.trim()) {
            return NextResponse.json(
                { success: false, error: "Tên rule là bắt buộc" },
                { status: 400 }
            );
        }

        if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
            return NextResponse.json(
                { success: false, error: "Cần ít nhất 1 điều kiện" },
                { status: 400 }
            );
        }

        if (!actions || !Array.isArray(actions) || actions.length === 0) {
            return NextResponse.json(
                { success: false, error: "Cần ít nhất 1 hành động" },
                { status: 400 }
            );
        }

        const rule = await prisma.syncRule.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                enabled,
                priority: Number(priority) || 0,
                targetType: targetType as RuleTargetType,
                conditions,
                conditionOperator,
                actions,
            },
        });

        return NextResponse.json({
            success: true,
            data: rule,
            message: "Rule đã được tạo thành công",
        });
    } catch (error: any) {
        console.error("Error creating rule:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
