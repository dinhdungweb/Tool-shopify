"use client";
import { useState, useEffect, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import RuleList from "@/components/sync-rules/RuleList";
import RuleBuilder from "@/components/sync-rules/RuleBuilder";

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

export default function SyncRulesPage() {
    const [rules, setRules] = useState<SyncRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<SyncRule | null>(null);

    const fetchRules = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/sync/rules");
            const data = await res.json();
            if (data.success) {
                setRules(data.data);
            }
        } catch (error) {
            console.error("Error fetching rules:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRules();
    }, [fetchRules]);

    const handleCreateNew = () => {
        setEditingRule(null);
        setIsModalOpen(true);
    };

    const handleEdit = (rule: SyncRule) => {
        setEditingRule(rule);
        setIsModalOpen(true);
    };

    const handleSave = async (ruleData: any) => {
        try {
            const url = editingRule
                ? `/api/sync/rules/${editingRule.id}`
                : "/api/sync/rules";
            const method = editingRule ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ruleData),
            });

            const data = await res.json();
            if (data.success) {
                setIsModalOpen(false);
                fetchRules();
            } else {
                alert(data.error || "Error saving rule");
            }
        } catch (error) {
            console.error("Error saving rule:", error);
            alert("Error saving rule");
        }
    };

    const handleDelete = async (ruleId: string) => {
        if (!confirm("Are you sure you want to delete this rule?")) return;

        try {
            const res = await fetch(`/api/sync/rules/${ruleId}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (data.success) {
                fetchRules();
            } else {
                alert(data.error || "Error deleting rule");
            }
        } catch (error) {
            console.error("Error deleting rule:", error);
        }
    };

    const handleToggle = async (rule: SyncRule) => {
        try {
            const res = await fetch(`/api/sync/rules/${rule.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: !rule.enabled }),
            });
            const data = await res.json();
            if (data.success) {
                fetchRules();
            }
        } catch (error) {
            console.error("Error toggling rule:", error);
        }
    };

    return (
        <div className="space-y-6">
            <PageBreadcrumb pageTitle="Sync Rules" />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                        Sync Rules & Automation
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Create and manage automation rules for product and customer sync
                    </p>
                </div>
                <Button onClick={handleCreateNew}>
                    + Create New Rule
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Rules</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{rules.length}</p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
                    <p className="text-2xl font-bold text-green-600">{rules.filter(r => r.enabled).length}</p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Product Rules</p>
                    <p className="text-2xl font-bold text-blue-600">{rules.filter(r => r.targetType === "PRODUCT").length}</p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Customer Rules</p>
                    <p className="text-2xl font-bold text-purple-600">{rules.filter(r => r.targetType === "CUSTOMER").length}</p>
                </div>
            </div>

            {/* Rules List */}
            <RuleList
                rules={rules}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggle={handleToggle}
            />

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                className="max-w-4xl"
            >
                <RuleBuilder
                    rule={editingRule}
                    onSave={handleSave}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>
        </div>
    );
}
