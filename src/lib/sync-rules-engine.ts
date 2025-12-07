// Sync Rules Engine - Evaluate and execute rules for products/customers
import { prisma } from "@/lib/prisma";
// Note: Run `npx prisma generate` to update Prisma Client types

// Types for conditions and actions
export interface RuleCondition {
    field: string;
    operator: string;
    value: string | number | boolean;
}

export interface RuleAction {
    type: string;
    params?: Record<string, any>;
}

export interface EvaluationContext {
    type: "product" | "customer";
    mapping: any;
    sourceData?: any; // Nhanh data
}

export interface EvaluationResult {
    matched: boolean;
    triggeredRules: Array<{
        ruleId: string;
        ruleName: string;
        actions: RuleAction[];
    }>;
    skipSync: boolean;
    requireApproval: boolean;
    approvalReason?: string;
    preActions: RuleAction[];
    postActions: RuleAction[];
}

// Operator evaluators
const operatorEvaluators: Record<string, (fieldValue: any, conditionValue: any) => boolean> = {
    "=": (a, b) => a == b,
    "!=": (a, b) => a != b,
    "<": (a, b) => Number(a) < Number(b),
    "<=": (a, b) => Number(a) <= Number(b),
    ">": (a, b) => Number(a) > Number(b),
    ">=": (a, b) => Number(a) >= Number(b),
    "contains": (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
    "startsWith": (a, b) => String(a).toLowerCase().startsWith(String(b).toLowerCase()),
    "endsWith": (a, b) => String(a).toLowerCase().endsWith(String(b).toLowerCase()),
    "isEmpty": (a) => !a || a === "" || a === null || a === undefined,
    "isNotEmpty": (a) => a && a !== "" && a !== null && a !== undefined,
};

// Field extractors for product
function getProductFieldValue(field: string, mapping: any, sourceData?: any): any {
    switch (field) {
        case "inventory":
            return sourceData?.quantity ?? mapping.nhanhQuantity ?? 0;
        case "price":
            return Number(mapping.nhanhPrice) || 0;
        case "priceChange":
            // Calculate percentage change if we have both prices
            const nhanhPrice = Number(mapping.nhanhPrice) || 0;
            const shopifyPrice = Number(mapping.shopifyPrice) || nhanhPrice;
            if (shopifyPrice === 0) return 0;
            return Math.abs((nhanhPrice - shopifyPrice) / shopifyPrice * 100);
        case "category":
            return sourceData?.categoryName || "";
        case "brand":
            return sourceData?.brandName || "";
        case "sku":
            return mapping.nhanhSku || "";
        case "barcode":
            return mapping.nhanhBarcode || "";
        case "syncStatus":
            return mapping.syncStatus;
        case "lastSyncedDays":
            if (!mapping.lastSyncedAt) return 999;
            const days = (Date.now() - new Date(mapping.lastSyncedAt).getTime()) / (1000 * 60 * 60 * 24);
            return Math.floor(days);
        default:
            return mapping[field];
    }
}

// Field extractors for customer
function getCustomerFieldValue(field: string, mapping: any, sourceData?: any): any {
    switch (field) {
        case "totalSpent":
            return Number(mapping.nhanhTotalSpent) || 0;
        case "ordersCount":
            return sourceData?.ordersCount ?? 0;
        case "hasPhone":
            return !!(mapping.nhanhCustomerPhone || sourceData?.phone);
        case "hasEmail":
            return !!(mapping.nhanhCustomerEmail || sourceData?.email);
        case "syncStatus":
            return mapping.syncStatus;
        case "lastSyncedDays":
            if (!mapping.lastSyncedAt) return 999;
            const days = (Date.now() - new Date(mapping.lastSyncedAt).getTime()) / (1000 * 60 * 60 * 24);
            return Math.floor(days);
        default:
            return mapping[field];
    }
}

// Evaluate a single condition
function evaluateCondition(
    condition: RuleCondition,
    context: EvaluationContext
): boolean {
    const getValue = context.type === "product" ? getProductFieldValue : getCustomerFieldValue;
    const fieldValue = getValue(condition.field, context.mapping, context.sourceData);
    const evaluator = operatorEvaluators[condition.operator];

    if (!evaluator) {
        console.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }

    return evaluator(fieldValue, condition.value);
}

// Evaluate all conditions for a rule
function evaluateConditions(
    conditions: RuleCondition[],
    conditionOperator: string,
    context: EvaluationContext
): boolean {
    if (!conditions || conditions.length === 0) {
        return true; // No conditions = always match
    }

    if (conditionOperator === "OR") {
        return conditions.some((c) => evaluateCondition(c, context));
    }

    // Default: AND
    return conditions.every((c) => evaluateCondition(c, context));
}

// Main function: Evaluate rules for a mapping
export async function evaluateRules(context: EvaluationContext): Promise<EvaluationResult> {
    const result: EvaluationResult = {
        matched: false,
        triggeredRules: [],
        skipSync: false,
        requireApproval: false,
        preActions: [],
        postActions: [],
    };

    try {
        // Get enabled rules for this target type, sorted by priority DESC
        const targetTypes =
            context.type === "product"
                ? ["PRODUCT", "ALL"]
                : ["CUSTOMER", "ALL"];

        const rules = await (prisma as any).syncRule.findMany({
            where: {
                enabled: true,
                targetType: { in: targetTypes },
            },
            orderBy: { priority: "desc" },
        });

        for (const rule of rules) {
            const conditions = rule.conditions as RuleCondition[];
            const actions = rule.actions as RuleAction[];

            const matched = evaluateConditions(conditions, rule.conditionOperator, context);

            if (matched) {
                result.matched = true;
                result.triggeredRules.push({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    actions,
                });

                // Process actions
                for (const action of actions) {
                    switch (action.type) {
                        case "SKIP_SYNC":
                            result.skipSync = true;
                            break;
                        case "REQUIRE_APPROVAL":
                            result.requireApproval = true;
                            result.approvalReason = action.params?.reason || rule.name;
                            break;
                        case "ADD_TAG":
                        case "REMOVE_TAG":
                            result.postActions.push(action);
                            break;
                        case "SET_INVENTORY":
                            result.preActions.push(action);
                            break;
                        case "LOG_WARNING":
                        case "SEND_NOTIFICATION":
                            result.postActions.push(action);
                            break;
                    }
                }

                // Update rule stats
                await (prisma as any).syncRule.update({
                    where: { id: rule.id },
                    data: {
                        triggerCount: { increment: 1 },
                        lastTriggered: new Date(),
                    },
                }).catch(() => { });

                // Log rule trigger
                await (prisma as any).syncRuleLog.create({
                    data: {
                        ruleId: rule.id,
                        mappingId: context.mapping.id,
                        mappingType: context.type,
                        triggered: true,
                        actionsExecuted: actions as any,
                        result: result.skipSync ? "SKIPPED" : "SUCCESS",
                        message: `Rule "${rule.name}" triggered`,
                    },
                }).catch(() => { });
            }
        }
    } catch (error) {
        console.error("Error evaluating rules:", error);
    }

    return result;
}

// Execute actions (for tags, notifications, etc.)
export async function executeActions(
    actions: RuleAction[],
    context: {
        mapping: any;
        shopifyApi?: any;
    }
): Promise<void> {
    for (const action of actions) {
        try {
            switch (action.type) {
                case "ADD_TAG":
                    if (context.shopifyApi && action.params?.tag) {
                        console.log(`[Rule] Adding tag "${action.params.tag}" to product`);
                        // TODO: Implement Shopify tag update
                    }
                    break;
                case "REMOVE_TAG":
                    if (context.shopifyApi && action.params?.tag) {
                        console.log(`[Rule] Removing tag "${action.params.tag}" from product`);
                        // TODO: Implement Shopify tag removal
                    }
                    break;
                case "LOG_WARNING":
                    console.warn(`[Rule Warning] ${action.params?.message || "Unknown warning"}`);
                    break;
                case "SEND_NOTIFICATION":
                    console.log(`[Rule Notification] ${action.params?.message || "Notification sent"}`);
                    // TODO: Implement notification system
                    break;
            }
        } catch (error) {
            console.error(`Error executing action ${action.type}:`, error);
        }
    }
}

// Test a rule with sample data (for preview/validation)
export function testRule(
    conditions: RuleCondition[],
    conditionOperator: string,
    testData: Record<string, any>,
    targetType: "product" | "customer"
): { matched: boolean; details: string[] } {
    const details: string[] = [];
    const context: EvaluationContext = {
        type: targetType,
        mapping: testData,
        sourceData: testData,
    };

    const results = conditions.map((c) => {
        const matched = evaluateCondition(c, context);
        const getValue = targetType === "product" ? getProductFieldValue : getCustomerFieldValue;
        const fieldValue = getValue(c.field, testData, testData);
        details.push(`${c.field} (${fieldValue}) ${c.operator} ${c.value} → ${matched ? "✓" : "✗"}`);
        return matched;
    });

    const matched = conditionOperator === "OR"
        ? results.some(Boolean)
        : results.every(Boolean);

    return { matched, details };
}
