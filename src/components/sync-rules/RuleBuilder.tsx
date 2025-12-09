"use client";
import { useState } from "react";
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
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Label from "@/components/form/Label";

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
    { value: "inventory", label: "Inventory" },
    { value: "price", label: "Price" },
    { value: "priceChange", label: "Price Change (%)" },
    { value: "category", label: "Category" },
    { value: "brand", label: "Brand" },
    { value: "sku", label: "SKU" },
    { value: "syncStatus", label: "Sync Status" },
    { value: "lastSyncedDays", label: "Days Since Last Sync" },
];

const CUSTOMER_FIELDS = [
    { value: "totalSpent", label: "Total Spent" },
    { value: "ordersCount", label: "Order Count" },
    { value: "hasPhone", label: "Has Phone" },
    { value: "hasEmail", label: "Has Email" },
    { value: "syncStatus", label: "Sync Status" },
    { value: "lastSyncedDays", label: "Days Since Last Sync" },
];

const OPERATORS = [
    { value: "=", label: "=" },
    { value: "!=", label: "≠" },
    { value: "<", label: "<" },
    { value: "<=", label: "≤" },
    { value: ">", label: ">" },
    { value: ">=", label: "≥" },
    { value: "contains", label: "Contains" },
    { value: "startsWith", label: "Starts With" },
];

const ACTION_TYPES = [
    { value: "SKIP_SYNC", label: "Skip Sync", hasParams: false },
    { value: "ADD_TAG", label: "Add Tag", hasParams: true, paramKey: "tag" },
    { value: "REMOVE_TAG", label: "Remove Tag", hasParams: true, paramKey: "tag" },
    { value: "REQUIRE_APPROVAL", label: "Require Approval", hasParams: true, paramKey: "reason" },
    { value: "LOG_WARNING", label: "Log Warning", hasParams: true, paramKey: "message" },
];

const TARGET_TYPE_OPTIONS = [
    { value: "PRODUCT", label: "Product" },
    { value: "CUSTOMER", label: "Customer" },
    { value: "ALL", label: "Both" },
];

const CONDITION_OPERATOR_OPTIONS = [
    { value: "AND", label: "All (AND)" },
    { value: "OR", label: "Any (OR)" },
];

// Sortable Item Component
function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 mb-3">
            <button
                {...attributes}
                {...listeners}
                type="button"
                className="cursor-grab p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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

    // Condition handlers
    const addCondition = () => {
        setConditions([
            ...conditions,
            { id: `c-${Date.now()}`, field: fieldOptions[0].value, operator: "=", value: "" },
        ]);
    };

    const removeCondition = (id: string) => {
        if (conditions.length > 1) {
            setConditions(conditions.filter((c) => c.id !== id));
        }
    };

    const updateCondition = (id: string, key: string, value: string) => {
        setConditions(conditions.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
    };

    // Action handlers
    const addAction = () => {
        setActions([...actions, { id: `a-${Date.now()}`, type: "SKIP_SYNC", params: {} }]);
    };

    const removeAction = (id: string) => {
        if (actions.length > 1) {
            setActions(actions.filter((a) => a.id !== id));
        }
    };

    const updateAction = (id: string, type: string, params: Record<string, string>) => {
        setActions(actions.map((a) => (a.id === id ? { ...a, type, params } : a)));
    };

    // Drag handlers
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

    // Save handler
    const handleSave = async () => {
        if (!name.trim()) {
            alert("Please enter a rule name");
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
        <div className="p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-gray-800 dark:text-white">
                {rule ? "Edit Rule" : "Create New Rule"}
            </h2>

            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-6">
                <div>
                    <Label>Rule Name *</Label>
                    <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Low Stock Alert"
                    />
                </div>
                <div>
                    <Label>Apply To</Label>
                    <Select
                        options={TARGET_TYPE_OPTIONS}
                        value={targetType}
                        onChange={(val) => setTargetType(val)}
                    />
                </div>
                <div className="sm:col-span-2">
                    <Label>Description</Label>
                    <Input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of this rule"
                    />
                </div>
            </div>

            {/* Conditions */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                        Conditions
                    </h3>
                    <Select
                        options={CONDITION_OPERATOR_OPTIONS}
                        value={conditionOperator}
                        onChange={(val) => setConditionOperator(val)}
                        className="w-36"
                    />
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleConditionDragEnd}>
                    <SortableContext items={conditions.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        {conditions.map((condition) => (
                            <SortableItem key={condition.id} id={condition.id}>
                                <div className="flex-1 flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <Select
                                        options={fieldOptions}
                                        value={condition.field}
                                        onChange={(val) => updateCondition(condition.id, "field", val)}
                                        className="w-40"
                                    />
                                    <Select
                                        options={OPERATORS}
                                        value={condition.operator}
                                        onChange={(val) => updateCondition(condition.id, "operator", val)}
                                        className="w-24"
                                    />
                                    <div className="flex-1">
                                        <Input
                                            type="text"
                                            value={condition.value}
                                            onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
                                            placeholder="Value"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeCondition(condition.id)}
                                        className="text-error-500 hover:text-error-700 px-2"
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
                    type="button"
                    onClick={addCondition}
                    className="mt-2 text-sm text-brand-500 hover:text-brand-600"
                >
                    + Add Condition
                </button>
            </div>

            {/* Actions */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
                    Actions
                </h3>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleActionDragEnd}>
                    <SortableContext items={actions.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                        {actions.map((action) => {
                            const actionType = ACTION_TYPES.find((t) => t.value === action.type);
                            return (
                                <SortableItem key={action.id} id={action.id}>
                                    <div className="flex-1 flex items-center gap-3 p-3 bg-success-50 dark:bg-gray-800 rounded-lg border border-success-200 dark:border-gray-700">
                                        <Select
                                            options={ACTION_TYPES}
                                            value={action.type}
                                            onChange={(val) => updateAction(action.id, val, {})}
                                            className="w-40"
                                        />
                                        {actionType?.hasParams && (
                                            <div className="flex-1">
                                                <Input
                                                    type="text"
                                                    value={action.params[actionType.paramKey || ""] || ""}
                                                    onChange={(e) => {
                                                        const paramKey = actionType.paramKey || "";
                                                        updateAction(action.id, action.type, { [paramKey]: e.target.value });
                                                    }}
                                                    placeholder={actionType.paramKey}
                                                />
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeAction(action.id)}
                                            className="text-error-500 hover:text-error-700 px-2"
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
                    type="button"
                    onClick={addAction}
                    className="mt-2 text-sm text-brand-500 hover:text-brand-600"
                >
                    + Add Action
                </button>
            </div>

            {/* Priority */}
            <div className="mb-6">
                <Label>Priority (higher runs first)</Label>
                <Input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-32"
                />
            </div>

            {/* Buttons */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                    {saving ? "Saving..." : "Save Rule"}
                </Button>
            </div>
        </div>
    );
}
