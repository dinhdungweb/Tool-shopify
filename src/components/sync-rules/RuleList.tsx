"use client";
import Badge from "@/components/ui/badge/Badge";
import { Loader } from "@/components/ui/loader";
import { PencilIcon, TrashBinIcon } from "@/icons";

interface SyncRule {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    priority: number;
    targetType: string;
    conditions: any[];
    conditionOperator: string;
    actions: any[];
    triggerCount: number;
    lastTriggered?: string;
    createdAt: string;
}

interface RuleListProps {
    rules: SyncRule[];
    loading: boolean;
    onEdit: (rule: SyncRule) => void;
    onDelete: (ruleId: string) => void;
    onToggle: (rule: SyncRule) => void;
}

export default function RuleList({
    rules,
    loading,
    onEdit,
    onDelete,
    onToggle,
}: RuleListProps) {
    const getTargetBadge = (type: string) => {
        const config: Record<string, { color: "primary" | "info" | "light"; label: string }> = {
            PRODUCT: { color: "primary", label: "Product" },
            CUSTOMER: { color: "info", label: "Customer" },
            ALL: { color: "light", label: "All" },
        };
        const item = config[type] || config.ALL;
        return (
            <Badge size="sm" color={item.color}>
                {item.label}
            </Badge>
        );
    };

    const getActionSummary = (actions: any[]) => {
        if (!actions || actions.length === 0) return "No actions";
        const actionLabels: Record<string, string> = {
            SKIP_SYNC: "Skip sync",
            ADD_TAG: "Add tag",
            REMOVE_TAG: "Remove tag",
            REQUIRE_APPROVAL: "Require approval",
            LOG_WARNING: "Log warning",
            SET_INVENTORY: "Set inventory",
        };
        return actions.map((a) => actionLabels[a.type] || a.type).join(", ");
    };

    if (loading) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
                <Loader text="Loading..." />
            </div>
        );
    }

    if (rules.length === 0) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                    No rules yet. Create your first rule to start automating.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                            <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                Status
                            </th>
                            <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                Rule Name
                            </th>
                            <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                Target
                            </th>
                            <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                Actions
                            </th>
                            <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                Triggered
                            </th>
                            <th className="px-5 py-3.5 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {rules.map((rule) => (
                            <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-5 py-4">
                                    <button
                                        onClick={() => onToggle(rule)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rule.enabled ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.enabled ? "translate-x-6" : "translate-x-1"
                                                }`}
                                        />
                                    </button>
                                </td>
                                <td className="px-5 py-4">
                                    <div>
                                        <p className="font-medium text-gray-800 dark:text-white/90">{rule.name}</p>
                                        {rule.description && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{rule.description}</p>
                                        )}
                                    </div>
                                </td>
                                <td className="px-5 py-4">{getTargetBadge(rule.targetType)}</td>
                                <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                                    {getActionSummary(rule.actions)}
                                </td>
                                <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                                    {rule.triggerCount} times
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => onEdit(rule)}
                                            className="p-2 text-gray-500 hover:text-brand-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            title="Edit"
                                        >
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(rule.id)}
                                            className="p-2 text-gray-500 hover:text-error-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                            title="Delete"
                                        >
                                            <TrashBinIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
