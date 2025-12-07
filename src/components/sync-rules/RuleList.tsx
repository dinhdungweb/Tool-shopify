"use client";
import Badge from "@/components/ui/badge/Badge";

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
            PRODUCT: { color: "primary", label: "Sản phẩm" },
            CUSTOMER: { color: "info", label: "Khách hàng" },
            ALL: { color: "light", label: "Tất cả" },
        };
        const item = config[type] || config.ALL;
        return (
            <Badge size="sm" color={item.color}>
                {item.label}
            </Badge>
        );
    };

    const getActionSummary = (actions: any[]) => {
        if (!actions || actions.length === 0) return "Không có hành động";
        const actionLabels: Record<string, string> = {
            SKIP_SYNC: "Bỏ qua sync",
            ADD_TAG: "Thêm tag",
            REMOVE_TAG: "Xóa tag",
            REQUIRE_APPROVAL: "Cần duyệt",
            LOG_WARNING: "Ghi log",
            SET_INVENTORY: "Set tồn kho",
        };
        return actions.map((a) => actionLabels[a.type] || a.type).join(", ");
    };

    if (loading) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto"></div>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Đang tải...</p>
            </div>
        );
    }

    if (rules.length === 0) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Chưa có rule nào. Tạo rule đầu tiên để bắt đầu tự động hóa.
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
                                Trạng thái
                            </th>
                            <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                Tên Rule
                            </th>
                            <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                Áp dụng cho
                            </th>
                            <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                Hành động
                            </th>
                            <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                                Đã kích hoạt
                            </th>
                            <th className="px-5 py-3.5 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                                Thao tác
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
                                    {rule.triggerCount} lần
                                </td>
                                <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => onEdit(rule)}
                                            className="px-3 py-1.5 text-sm font-medium text-brand-500 hover:text-brand-600 rounded-md hover:bg-brand-50 dark:hover:bg-brand-500/10"
                                        >
                                            Sửa
                                        </button>
                                        <button
                                            onClick={() => onDelete(rule.id)}
                                            className="px-3 py-1.5 text-sm font-medium text-error-500 hover:text-error-600 rounded-md hover:bg-error-50 dark:hover:bg-error-500/10"
                                        >
                                            Xóa
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
