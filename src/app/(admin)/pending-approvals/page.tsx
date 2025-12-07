"use client";
import { useState, useEffect, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";

interface PendingItem {
    id: string;
    name: string;
    identifier: string;
    details: string;
    updatedAt: string;
}

export default function PendingApprovalsPage() {
    const [products, setProducts] = useState<PendingItem[]>([]);
    const [customers, setCustomers] = useState<PendingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<"products" | "customers">("products");

    const fetchPending = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/sync/pending-approvals");
            const data = await res.json();

            if (data.success) {
                setProducts(
                    data.data.products.map((p: any) => ({
                        id: p.id,
                        name: p.nhanhProductName,
                        identifier: p.nhanhSku || p.nhanhProductId,
                        details: `Price: ${Number(p.nhanhPrice).toLocaleString()}đ`,
                        updatedAt: new Date(p.updatedAt).toLocaleString("en-US"),
                    }))
                );
                setCustomers(
                    data.data.customers.map((c: any) => ({
                        id: c.id,
                        name: c.nhanhCustomerName,
                        identifier: c.nhanhCustomerPhone || c.nhanhCustomerEmail || c.nhanhCustomerId,
                        details: c.nhanhCustomerEmail || "",
                        updatedAt: new Date(c.updatedAt).toLocaleString("en-US"),
                    }))
                );
            }
        } catch (error) {
            console.error("Error fetching pending:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPending();
    }, [fetchPending]);

    const handleAction = async (type: "product" | "customer", action: "approve" | "reject") => {
        const ids = type === "product" ? selectedProducts : selectedCustomers;
        if (ids.length === 0) {
            alert("Please select at least 1 item");
            return;
        }

        setProcessing(true);
        try {
            const res = await fetch("/api/sync/pending-approvals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids, type, action }),
            });

            const data = await res.json();
            if (data.success) {
                alert(data.message);
                fetchPending();
                if (type === "product") setSelectedProducts([]);
                else setSelectedCustomers([]);
            } else {
                alert(data.error || "Processing error");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Error processing request");
        } finally {
            setProcessing(false);
        }
    };

    const toggleSelect = (type: "product" | "customer", id: string) => {
        if (type === "product") {
            setSelectedProducts((prev) =>
                prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
            );
        } else {
            setSelectedCustomers((prev) =>
                prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
            );
        }
    };

    const toggleSelectAll = (type: "product" | "customer") => {
        if (type === "product") {
            setSelectedProducts(selectedProducts.length === products.length ? [] : products.map((p) => p.id));
        } else {
            setSelectedCustomers(selectedCustomers.length === customers.length ? [] : customers.map((c) => c.id));
        }
    };

    const currentItems = activeTab === "products" ? products : customers;
    const currentSelected = activeTab === "products" ? selectedProducts : selectedCustomers;

    return (
        <div className="space-y-6">
            <PageBreadcrumb pageTitle="Pending Approvals" />

            <div className="flex flex-col gap-5 sm:flex-row sm:justify-between sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Pending Approvals</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Items waiting for approval before syncing
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900 w-fit">
                    <button
                        onClick={() => setActiveTab("products")}
                        className={`px-3 py-2 font-medium rounded-md text-sm transition-colors flex items-center gap-2 ${activeTab === "products"
                                ? "shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            }`}
                    >
                        Products
                        {products.length > 0 && (
                            <Badge size="sm" color="warning">
                                {products.length}
                            </Badge>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("customers")}
                        className={`px-3 py-2 font-medium rounded-md text-sm transition-colors flex items-center gap-2 ${activeTab === "customers"
                                ? "shadow-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            }`}
                    >
                        Customers
                        {customers.length > 0 && (
                            <Badge size="sm" color="warning">
                                {customers.length}
                            </Badge>
                        )}
                    </button>
                </div>
            </div>

            {/* Actions */}
            {currentItems.length > 0 && (
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => handleAction(activeTab === "products" ? "product" : "customer", "approve")}
                        disabled={currentSelected.length === 0 || processing}
                        size="sm"
                    >
                        ✓ Approve ({currentSelected.length})
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleAction(activeTab === "products" ? "product" : "customer", "reject")}
                        disabled={currentSelected.length === 0 || processing}
                        size="sm"
                    >
                        ✕ Reject ({currentSelected.length})
                    </Button>
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto"></div>
                        <p className="mt-4 text-gray-500 dark:text-gray-400">Loading...</p>
                    </div>
                ) : currentItems.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        No items pending approval
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-800">
                                    <th className="px-5 py-3.5 text-left">
                                        <input
                                            type="checkbox"
                                            checked={currentSelected.length === currentItems.length && currentItems.length > 0}
                                            onChange={() => toggleSelectAll(activeTab === "products" ? "product" : "customer")}
                                            className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                                        />
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Name</th>
                                    <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">ID/SKU</th>
                                    <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Details</th>
                                    <th className="px-5 py-3.5 text-left text-sm font-medium text-gray-500 dark:text-gray-400">Updated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {currentItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-5 py-4">
                                            <input
                                                type="checkbox"
                                                checked={currentSelected.includes(item.id)}
                                                onChange={() => toggleSelect(activeTab === "products" ? "product" : "customer", item.id)}
                                                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                                            />
                                        </td>
                                        <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">{item.name}</td>
                                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">{item.identifier}</td>
                                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">{item.details}</td>
                                        <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">{item.updatedAt}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
