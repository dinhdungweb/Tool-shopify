// API Route: Test/Evaluate a rule with sample data
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { testRule } from "@/lib/sync-rules-engine";

export const dynamic = "force-dynamic";

// POST: Test rule with sample data
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ruleId, conditions, conditionOperator, targetType, testData } = body;

        // If ruleId provided, fetch rule from DB
        let ruleConditions = conditions;
        let ruleOperator = conditionOperator || "AND";
        let ruleTargetType = targetType || "product";

        if (ruleId) {
            const rule = await prisma.syncRule.findUnique({ where: { id: ruleId } });
            if (!rule) {
                return NextResponse.json(
                    { success: false, error: "Rule not found" },
                    { status: 404 }
                );
            }
            ruleConditions = rule.conditions;
            ruleOperator = rule.conditionOperator;
            ruleTargetType = rule.targetType.toLowerCase();
        }

        if (!ruleConditions || !Array.isArray(ruleConditions)) {
            return NextResponse.json(
                { success: false, error: "Conditions are required" },
                { status: 400 }
            );
        }

        if (!testData || typeof testData !== "object") {
            return NextResponse.json(
                { success: false, error: "Test data is required" },
                { status: 400 }
            );
        }

        // Evaluate
        const result = testRule(
            ruleConditions,
            ruleOperator,
            testData,
            ruleTargetType as "product" | "customer"
        );

        return NextResponse.json({
            success: true,
            data: {
                matched: result.matched,
                details: result.details,
                conditionOperator: ruleOperator,
                testData,
            },
        });
    } catch (error: any) {
        console.error("Error evaluating rule:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
