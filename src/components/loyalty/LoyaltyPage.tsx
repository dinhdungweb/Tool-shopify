"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    ShootingStarIcon,
    SyncIcon,
    PlusIcon,
    ClockIcon,
    CheckCircleIcon,
    AlertIcon,
    TrashBinIcon,
    CalenderIcon,
    BoxIcon,
    ListIcon,
    EyeIcon,
    TagIcon,
    InfoIcon,
    PencilIcon,
} from "../../icons";

// ============= Types =============
interface TierStat {
    tier: string;
    label: string;
    color: string;
    min: number;
    totalCustomers: number;
    syncedCustomers: number;
}

// Custom MultiSelect Component
function MultiSelectTier({
    options,
    selected,
    onChange
}: {
    options: TierStat[];
    selected: string[];
    onChange: (selected: string[]) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (tier: string) => {
        const newSelected = selected.includes(tier)
            ? selected.filter((t) => t !== tier)
            : [...selected, tier];
        onChange(newSelected);
    };

    const displayText = selected.length === 0
        ? "-- Select Tier(s) --"
        : selected.length === options.length
            ? "All Tiers Selected"
            : `${selected.length} tiers selected (${selected.map(t => options.find(o => o.tier === t)?.label).join(", ")})`;

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-left text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
            >
                <span className="truncate block pr-6">{displayText}</span>
                <span className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </span>
            </button>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {options.map((option) => (
                        <div
                            key={option.tier}
                            onClick={() => toggleOption(option.tier)}
                            className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer flex items-center gap-3"
                        >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selected.includes(option.tier)
                                ? "bg-blue-600 border-blue-600"
                                : "border-gray-300 dark:border-gray-500"
                                }`}>
                                {selected.includes(option.tier) && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                            <span className="text-sm text-gray-900 dark:text-white">
                                {option.label}
                                <span className="ml-1 text-gray-500 text-xs">({option.syncedCustomers} synced)</span>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface ExpirationSchedule {
    id: string;
    tier: string;
    pointsAdded: number;
    expiresAt: string;
    status: string;
    executedAt: string | null;
    affectedCount: number;
    description: string | null;
    createdAt: string;
}

// ============= Component =============
export default function LoyaltyPage() {
    const [stats, setStats] = useState<TierStat[]>([]);
    const [schedules, setSchedules] = useState<ExpirationSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [checkingExpiry, setCheckingExpiry] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // Form state
    const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
    const [points, setPoints] = useState("");
    const [expirationDate, setExpirationDate] = useState("");

    // ============= Fetch Data =============
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsRes, schedulesRes] = await Promise.all([
                fetch("/api/rewards/tier-stats"),
                fetch("/api/rewards/expiration"),
            ]);

            const statsData = await statsRes.json();
            const schedulesData = await schedulesRes.json();

            if (statsData.success) setStats(statsData.data.stats);
            if (schedulesData.success) setSchedules(schedulesData.data);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ============= Actions =============
    const showToast = (message: string, type: "success" | "error") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 5000);
    };

    const handleRecalculate = async () => {
        if (!confirm("Recalculate tiers for all customers? This process may take a few minutes.")) return;
        setRecalculating(true);
        try {
            const res = await fetch("/api/rewards/tier-stats", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                showToast(data.data.message, "success");
                fetchData();
            } else {
                showToast(data.error || "Error!", "error");
            }
        } catch (error) {
            showToast("Server connection error!", "error");
        } finally {
            setRecalculating(false);
        }
    };

    const handleAddPoints = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedTiers.length === 0 || !points || Number(points) <= 0) {
            showToast("Please select at least one tier and enter valid points!", "error");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/rewards/add-points", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tiers: selectedTiers,
                    points: Number(points),
                    expirationDate: expirationDate || null,
                }),
            });

            const data = await res.json();
            if (data.success) {
                showToast(data.data.message, "success");
                setSelectedTiers([]);
                setPoints("");
                setExpirationDate("");
                fetchData();
            } else {
                showToast(data.error || "Error!", "error");
            }
        } catch (error) {
            showToast("Server connection error!", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCheckExpiry = async () => {
        setCheckingExpiry(true);
        try {
            const res = await fetch("/api/rewards/expiration", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                showToast(data.data.message, "success");
                fetchData();
            } else {
                showToast(data.error || "Error!", "error");
            }
        } catch (error) {
            showToast("Server connection error!", "error");
        } finally {
            setCheckingExpiry(false);
        }
    };

    const handleCancelSchedule = async (id: string) => {
        if (!confirm("Are you sure you want to cancel this expiration schedule?")) return;
        try {
            const res = await fetch(`/api/rewards/expiration?id=${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                showToast("Expiration schedule cancelled!", "success");
                fetchData();
            } else {
                showToast(data.error || "Error!", "error");
            }
        } catch (error) {
            showToast("Server connection error!", "error");
        }
    };

    // ============= Helpers =============
    const formatVND = (amount: number) =>
        new Intl.NumberFormat("vi-VN").format(amount) + "đ";

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleString("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });

    const getStatusBadge = (status: string) => {
        const map: Record<string, { bg: string; text: string; label: string }> = {
            PENDING: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", label: "Pending" },
            EXECUTED: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", label: "Executed" },
            CANCELLED: { bg: "bg-gray-100 dark:bg-gray-700/30", text: "text-gray-500 dark:text-gray-400", label: "Cancelled" },
        };
        const s = map[status] || map.PENDING;
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
                {s.label}
            </span>
        );
    };

    const getTierBadgeStyle = (color: string, tier: string) => {
        const colorMap: Record<string, string> = {
            BLACK_DIAMOND: "bg-gray-900 text-white dark:bg-gray-800",
            DIAMOND: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
            PLATINUM: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
            GOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
            SILVER: "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200",
            MEMBER: "bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300",
        };
        return colorMap[tier] || "bg-gray-100 text-gray-600";
    };

    // ============= Render =============
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-500 dark:text-gray-400">Loading data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl  text-white transition-all duration-300 ${toast.type === "success" ? "bg-green-500" : "bg-red-500"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <span>
                            {toast.type === "success" ? (
                                <CheckCircleIcon className="w-5 h-5 text-white" />
                            ) : (
                                <AlertIcon className="w-5 h-5 text-white" />
                            )}
                        </span>
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-3 hover:opacity-80">✕</button>
                    </div>
                </div>
            )}

            {/* ===================== HEADER ===================== */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
                        <ShootingStarIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Loyalty & Rewards
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Manage customer tiers and reward points
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleRecalculate}
                    disabled={recalculating}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors "
                >
                    {recalculating ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Recalculating...</span>
                        </>
                    ) : (
                        <>
                            <SyncIcon className="w-4 h-4" />
                            <span>Recalculate Tiers</span>
                        </>
                    )}
                </button>
            </div>

            {/* ===================== TIER STATS ===================== */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {stats.map((stat) => (
                    <div
                        key={stat.tier}
                        className="bg-white dark:bg-gray-800 rounded-xl p-4  border border-gray-200 dark:border-gray-700 hover: group"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getTierBadgeStyle(stat.color, stat.tier)}`}>
                                {stat.label}
                            </span>
                            <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded-full group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors">
                                <PencilIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" />
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {stat.totalCustomers.toLocaleString("vi-VN")}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Mapped Customers
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                                {stat.syncedCustomers.toLocaleString("vi-VN")}
                            </div>
                            <div className="text-xs text-gray-400">Synced to Shopify</div>
                        </div>
                        <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                            <span>From</span>
                            <span>{formatVND(stat.min)}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ===================== ADD POINTS FORM ===================== */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="rounded-t-xl p-5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 bg-gray-50/50 dark:bg-gray-800">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                        <BoxIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Add Reward Points
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Add points to all customers in the selected tier
                        </p>
                    </div>
                </div>

                <form onSubmit={handleAddPoints} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Chọn hạng */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <TagIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                Customer Tier <span className="text-red-500">*</span>
                            </label>
                            <MultiSelectTier
                                options={stats}
                                selected={selectedTiers}
                                onChange={setSelectedTiers}
                            />
                        </div>

                        {/* Số điểm */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <PlusIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                Points to Add <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={points}
                                onChange={(e) => setPoints(e.target.value)}
                                placeholder="Enter points..."
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>

                        {/* Ngày hết hạn */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <CalenderIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                Points Expiration Date
                            </label>
                            <input
                                type="datetime-local"
                                value={expirationDate}
                                onChange={(e) => setExpirationDate(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-400">
                                Optional: Points will reset to 0 after this date
                            </p>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                        {selectedTiers.length > 0 && points ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800/30 text-sm">
                                <InfoIcon className="w-4 h-4 flex-shrink-0" />
                                <span>
                                    Will add <strong>{Number(points).toLocaleString("vi-VN")} points</strong> to{" "}
                                    Will add <strong>{Number(points).toLocaleString("vi-VN")} points</strong> to{" "}
                                    <strong>
                                        {stats
                                            .filter(s => selectedTiers.includes(s.tier))
                                            .reduce((acc, curr) => acc + curr.syncedCustomers, 0)
                                            .toLocaleString("vi-VN")}
                                    </strong> customers in <strong>{selectedTiers.length}</strong> selected tiers
                                </span>
                            </div>
                        ) : (
                            <div />
                        )}

                        <button
                            type="submit"
                            disabled={submitting || selectedTiers.length === 0 || !points}
                            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors  flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <PlusIcon className="w-5 h-5" />
                                    <span>Add Points</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* ===================== EXPIRATION SCHEDULES ===================== */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="rounded-t-xl p-5 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                            <ClockIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Points Reset Schedule
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                Scheduled automated point expirations
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleCheckExpiry}
                        disabled={checkingExpiry}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50 text-sm font-medium transition-colors "
                    >
                        {checkingExpiry ? (
                            <>
                                <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                <span>Checking...</span>
                            </>
                        ) : (
                            <>
                                <EyeIcon className="w-4 h-4" />
                                <span>Check & Execute Now</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="overflow-x-auto">
                    {schedules.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full mb-3">
                                <ListIcon className="w-8 h-8 opacity-50" />
                            </div>
                            <p>No expiration schedules found</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50/50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-5 py-4 text-gray-500 dark:text-gray-400 font-medium">Customer Tier</th>
                                    <th className="px-5 py-4 text-gray-500 dark:text-gray-400 font-medium">Points Added</th>
                                    <th className="px-5 py-4 text-gray-500 dark:text-gray-400 font-medium">Expiration Time</th>
                                    <th className="px-5 py-4 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                                    <th className="px-5 py-4 text-gray-500 dark:text-gray-400 font-medium">Affected</th>
                                    <th className="px-5 py-4 text-gray-500 dark:text-gray-400 font-medium">Description</th>
                                    <th className="px-5 py-4 text-right text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {schedules.map((schedule) => {
                                    const tierInfo = stats.find((s) => s.tier === schedule.tier);
                                    return (
                                        <tr key={schedule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${getTierBadgeStyle("", schedule.tier)}`}>
                                                    {tierInfo?.label || schedule.tier}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 font-semibold text-blue-600 dark:text-blue-400">
                                                +{schedule.pointsAdded.toLocaleString("vi-VN")}
                                            </td>
                                            <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                                                <div className="flex items-center gap-2">
                                                    <ClockIcon className="w-4 h-4 text-gray-400" />
                                                    {formatDate(schedule.expiresAt)}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">{getStatusBadge(schedule.status)}</td>
                                            <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                                                {schedule.affectedCount.toLocaleString("vi-VN")} customers
                                            </td>
                                            <td className="px-5 py-4 text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate" title={schedule.description || ""}>
                                                {schedule.description || "-"}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                {schedule.status === "PENDING" && (
                                                    <button
                                                        onClick={() => handleCancelSchedule(schedule.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-medium transition-colors"
                                                    >
                                                        <TrashBinIcon className="w-4 h-4" />
                                                        Cancel
                                                    </button>
                                                )}
                                                {schedule.status === "EXECUTED" && schedule.executedAt && (
                                                    <span className="text-xs text-gray-400 flex items-center justify-end gap-1">
                                                        <CheckCircleIcon className="w-3 h-3" />
                                                        {formatDate(schedule.executedAt)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}


// Force update English UI
