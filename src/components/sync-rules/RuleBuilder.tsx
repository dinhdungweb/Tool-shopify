"use client";
import { useState, useCallback } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/components/ui/button/Button";

// Condition and Action types
interface Condition {
    id: string;
    field: string;
    operator: string;
    value: string;
}

interface Action {
    id: string;
    type: string;
    params: Record<string, string>;
}

interface RuleBuilderProps {
    rule?: any;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
}

// Field options by target type
const PRODUCT_FIELDS = [
    { value: "inventory", label: "Tồn kho" },
    { value: "price", label: "Giá" },
    { value: "priceChange", label: "Thay đổi giá (%)" },
    { value: "category", label: "Danh mục" },
    { value: "brand", label: "Thương hiệu" },
    { value: "sku", label: "SKU" },
    { value: "syncStatus", label: "Trạng thái sync" },
    { value: "lastSyncedDays", label: "Ngày kể từ sync cuối" },
];

const CUSTOMER_FIELDS = [
    { value: "totalSpent", label: "Tổng chi tiêu" },
    { value: "ordersCount", label: "Số đơn hàng" },
    { value: "hasPhone", label: "Có số điện thoại" },
    { value: "hasEmail", label: "Có email" },
    { value: "syncStatus", label: "Trạng thái sync" },
    { value: "lastSyncedDays", label: "Ngày kể từ sync cuối" },
];

const OPERATORS = [
    { value: "=", label: "=" },
    { value: "!=", label: "≠" },
    { value: "<", label: "<" },
    { value: "<=", label: "≤" },
    { value: ">", label: ">" },
    { value: ">=", label: "≥" },
    { value: "contains", label: "Chứa" },
    { value: "startsWith", label: "Bắt đầu với" },
];

const ACTION_TYPES = [
    { value: "SKIP_SYNC", label: "Bỏ qua sync", hasParams: false },
    { value: "ADD_TAG", label: "Thêm tag", hasParams: true, paramKey: "tag" },
    { value: "REMOVE_TAG", label: "Xóa tag", hasParams: true, paramKey: "tag" },
    { value: "REQUIRE_APPROVAL", label: "Yêu cầu duyệt", hasParams: true, paramKey: "reason" },
    { value: "LOG_WARNING", label: "Ghi cảnh báo", hasParams: true, paramKey: "message" },
];

// Sortable Item Component
function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 mb-2">
            <button
                {...attributes}
                {...listeners}
                className="cursor-grab p-2 text-gray-400 hover:text-gray-600"
            >
                ⋮⋮
            </button>
            {children}
        </div>
    );
}

export default function RuleBuilder({ rule, onSave, onCancel }: RuleBuilderProps) {
    const [name, setName] = useState(rule?.name || "");
    const [description, setDescription] = useState(rule?.description || "");
    const [targetType, setTargetType] = useState(rule?.targetType || "PRODUCT");
    const [conditionOperator, setConditionOperator] = useState(rule?.conditionOperator || "AND");
    const [priority, setPriority] = useState(rule?.priority || 0);
    const [saving, setSaving] = useState(false);

    const [conditions, setConditions] = useState<Condition[]>(() => {
        if (rule?.conditions) {
            return rule.conditions.map((c: any, i: number) => ({ ...c, id: `c-${i}` }));
        }
        return [{ id: "c-0", field: "inventory", operator: "<", value: "" }];
    });

    const [actions, setActions] = useState<Action[]>(() => {
        if (rule?.actions) {
            return rule.actions.map((a: any, i: number) => ({ ...a, id: `a-${i}` }));
        }
        return [{ id: "a-0", type: "SKIP_SYNC", params: {} }];
    });

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const fieldOptions = targetType === "CUSTOMER" ? CUSTOMER_FIELDS : PRODUCT_FIELDS;

    // Add new condition
    const addCondition = () => {
        setConditions([
            ...conditions,
            { id: `c-${Date.now()}`, field: fieldOptions[0].value, operator: "=", value: "" },
        ]);
    };

    // Remove condition
    const removeCondition = (id: string) => {
        if (conditions.length > 1) {
            setConditions(conditions.filter((c) => c.id !== id));
        }
    };

    // Update condition
    const updateCondition = (id: string, key: string, value: string) => {
        setConditions(
            conditions.map((c) => (c.id === id ? { ...c, [key]: value } : c))
        );
    };

    // Add new action
    const addAction = () => {
        setActions([
            ...actions,
            { id: `a-${Date.now()}`, type: "SKIP_SYNC", params: {} },
        ]);
    };

    // Remove action
    const removeAction = (id: string) => {
        if (actions.length > 1) {
            setActions(actions.filter((a) => a.id !== id));
        }
    };

    // Update action
    const updateAction = (id: string, type: string, params: Record<string, string>) => {
        setActions(
            actions.map((a) => (a.id === id ? { ...a, type, params } : a))
        );
    };

    // Handle drag end for conditions
    const handleConditionDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setConditions((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Handle drag end for actions
    const handleActionDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setActions((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Handle save
    const handleSave = async () => {
        if (!name.trim()) {
            alert("Vui lòng nhập tên rule");
            return;
        }

        setSaving(true);
        try {
            await onSave({
                name,
                description,
                targetType,
                conditionOperator,
                priority: Number(priority),
                conditions: conditions.map(({ id, ...rest }) => rest),
                actions: actions.map(({ id, ...rest }) => rest),
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-white">
                {rule ? "Chỉnh sửa Rule" : "Tạo Rule Mới"}
            </h2>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Tên Rule *
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        placeholder="VD: Low Stock Alert"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Áp dụng cho
                    </label>
                    <select
                        value={targetType}
                        onChange={(e) => setTargetType(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    >
                        <option value="PRODUCT">Sản phẩm</option>
                        <option value="CUSTOMER">Khách hàng</option>
                        <option value="ALL">Cả hai</option>
                    </select>
                </div>
                <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Mô tả
                    </label>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Mô tả ngắn về rule này"
                    />
                </div>
            </div>

            {/* Conditions */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                        Điều kiện (Conditions)
                    </h3>
                    <select
                        value={conditionOperator}
                        onChange={(e) => setConditionOperator(e.target.value)}
                        className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                    >
                        <option value="AND">Tất cả (AND)</option>
                        <option value="OR">Bất kỳ (OR)</option>
                    </select>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleConditionDragEnd}>
                    <SortableContext items={conditions.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        {conditions.map((condition) => (
                            <SortableItem key={condition.id} id={condition.id}>
                                <div className="flex-1 flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <select
                                        value={condition.field}
                                        onChange={(e) => updateCondition(condition.id, "field", e.target.value)}
                                        className="px-2 py-1 border rounded dark:bg-gray-600 dark:border-gray-500 text-sm"
                                    >
                                        {fieldOptions.map((f) => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={condition.operator}
                                        onChange={(e) => updateCondition(condition.id, "operator", e.target.value)}
                                        className="px-2 py-1 border rounded dark:bg-gray-600 dark:border-gray-500 text-sm"
                                    >
                                        {OPERATORS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={condition.value}
                                        onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
                                        className="flex-1 px-2 py-1 border rounded dark:bg-gray-600 dark:border-gray-500 text-sm"
                                        placeholder="Giá trị"
                                    />
                                    <button
                                        onClick={() => removeCondition(condition.id)}
                                        className="text-red-500 hover:text-red-700 px-2"
                                        disabled={conditions.length === 1}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </SortableItem>
                        ))}
                    </SortableContext>
                </DndContext>

                <button
                    onClick={addCondition}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                    + Thêm điều kiện
                </button>
            </div>

            {/* Actions */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                    Hành động (Actions)
                </h3>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleActionDragEnd}>
                    <SortableContext items={actions.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                        {actions.map((action) => {
                            const actionType = ACTION_TYPES.find((t) => t.value === action.type);
                            return (
                                <SortableItem key={action.id} id={action.id}>
                                    <div className="flex-1 flex items-center gap-2 p-3 bg-green-50 dark:bg-gray-700 rounded-lg">
                                        <select
                                            value={action.type}
                                            onChange={(e) => updateAction(action.id, e.target.value, {})}
                                            className="px-2 py-1 border rounded dark:bg-gray-600 dark:border-gray-500 text-sm"
                                        >
                                            {ACTION_TYPES.map((t) => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                        {ACTION_TYPES.find((t) => t.value === action.type)?.hasParams && (
                                            <input
                                                type="text"
                                                value={action.params[ACTION_TYPES.find((t) => t.value === action.type)?.paramKey || ""] || ""}
                                                onChange={(e) => {
                                                    const paramKey = ACTION_TYPES.find((t) => t.value === action.type)?.paramKey || "";
                                                    updateAction(action.id, action.type, { [paramKey]: e.target.value });
                                                }}
                                                className="flex-1 px-2 py-1 border rounded dark:bg-gray-600 dark:border-gray-500 text-sm"
                                                placeholder={ACTION_TYPES.find((t) => t.value === action.type)?.paramKey}
                                            />
                                        )}
                                        <button
                                            onClick={() => removeAction(action.id)}
                                            className="text-red-500 hover:text-red-700 px-2"
                                            disabled={actions.length === 1}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </SortableItem>
                            );
                        })}
                    </SortableContext>
                </DndContext>

                <button
                    onClick={addAction}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                    + Thêm hành động
                </button>
            </div>

            {/* Priority */}
            <div className="mb-6">
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Độ ưu tiên (priority cao hơn = chạy trước)
                </label>
                <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-32 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    min={0}
                    max={100}
                />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onCancel}>
                    Hủy
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Đang lưu..." : "Lưu Rule"}
                </Button>
            </div>
        </div>
    );
}
