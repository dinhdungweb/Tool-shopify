// API Route: Single Rule CRUD
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RuleTargetType } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET: Get single rule
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const rule = await prisma.syncRule.findUnique({
            where: { id },
            include: {
                logs: {
                    orderBy: { createdAt: "desc" },
                    take: 20,
                },
                _count: {
                    select: { logs: true },
                },
            },
        });

        if (!rule) {
            return NextResponse.json(
                { success: false, error: "Rule not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: rule,
        });
    } catch (error: any) {
        console.error("Error fetching rule:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT: Update rule
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const {
            name,
            description,
            enabled,
            priority,
            targetType,
            conditions,
            conditionOperator,
            actions,
        } = body;

        // Check if rule exists
        const existing = await prisma.syncRule.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Rule not found" },
                { status: 404 }
            );
        }

        // Build update data
        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (enabled !== undefined) updateData.enabled = enabled;
        if (priority !== undefined) updateData.priority = Number(priority) || 0;
        if (targetType !== undefined) updateData.targetType = targetType as RuleTargetType;
        if (conditions !== undefined) updateData.conditions = conditions;
        if (conditionOperator !== undefined) updateData.conditionOperator = conditionOperator;
        if (actions !== undefined) updateData.actions = actions;

        const rule = await prisma.syncRule.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            data: rule,
            message: "Rule đã được cập nhật",
        });
    } catch (error: any) {
        console.error("Error updating rule:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE: Delete rule
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check if rule exists
        const existing = await prisma.syncRule.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Rule not found" },
                { status: 404 }
            );
        }

        await prisma.syncRule.delete({ where: { id } });

        return NextResponse.json({
            success: true,
            message: "Rule đã được xóa",
        });
    } catch (error: any) {
        console.error("Error deleting rule:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
