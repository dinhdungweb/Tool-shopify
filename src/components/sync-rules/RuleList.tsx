"use client";

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
        const styles: Record<string, string> = {
            PRODUCT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
            CUSTOMER: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
            ALL: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
        };
        const labels: Record<string, string> = {
            PRODUCT: "Sản phẩm",
            CUSTOMER: "Khách hàng",
            ALL: "Tất cả",
        };
        return (
            <span className={`px-2 py-1 text-xs rounded-full ${styles[type] || styles.ALL}`}>
                {labels[type] || type}
            </span>
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
        return actions.map(a => actionLabels[a.type] || a.type).join(", ");
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto"></div>
                <p className="mt-4 text-gray-500 dark:text-gray-400">Đang tải...</p>
            </div>
        );
    }

    if (rules.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Chưa có rule nào. Tạo rule đầu tiên để bắt đầu tự động hóa.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Trạng thái
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Tên Rule
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Áp dụng cho
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Hành động
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Đã kích hoạt
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Thao tác
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {rules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                            <td className="px-4 py-3">
                                <button
                                    onClick={() => onToggle(rule)}
                                    className={`w-12 h-6 rounded-full relative transition-colors ${rule.enabled ? "bg-green-500" : "bg-gray-300"
                                        }`}
                                >
                                    <span
                                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${rule.enabled ? "right-1" : "left-1"
                                            }`}
                                    />
                                </button>
                            </td>
                            <td className="px-4 py-3">
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-white">
                                        {rule.name}
                                    </p>
                                    {rule.description && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {rule.description}
                                        </p>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                {getTargetBadge(rule.targetType)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                {getActionSummary(rule.actions)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                {rule.triggerCount} lần
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                                <button
                                    onClick={() => onEdit(rule)}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                    Sửa
                                </button>
                                <button
                                    onClick={() => onDelete(rule.id)}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                >
                                    Xóa
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
