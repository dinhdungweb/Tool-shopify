"use client";

import { useEffect, useState } from "react";
import { nhanhClient, syncClient, shopifyClient } from "@/lib/api-client";
import { NhanhCustomer } from "@/types/nhanh";
import { CustomerMappingData, SyncStatus } from "@/types/mapping";
import SyncStatusBadge from "./SyncStatusBadge";
import MappingModal from "./MappingModal";
import GlobalAutoSyncSettings from "./GlobalAutoSyncSettings";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";
import { Modal } from "../ui/modal";
import Checkbox from "../form/input/Checkbox";

export default function CustomerSyncTable() {
  const [customers, setCustomers] = useState<NhanhCustomer[]>([]);
  const [mappings, setMappings] = useState<Map<string, CustomerMappingData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [autoSyncModalOpen, setAutoSyncModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<NhanhCustomer | null>(null);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<"all" | "mapped" | "unmapped" | "pending" | "synced" | "failed">("all");
  const [syncedCount, setSyncedCount] = useState(0);
  const [pullDropdownOpen, setPullDropdownOpen] = useState(false);
  const [shopifyPullDropdownOpen, setShopifyPullDropdownOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [selectDropdownOpen, setSelectDropdownOpen] = useState(false);
  const [customFilterModalOpen, setCustomFilterModalOpen] = useState(false);
  const [customFilterInput, setCustomFilterInput] = useState("");
  const [savedFilters, setSavedFilters] = useState<string[]>([]);
  const [nhanhCustomFilterModalOpen, setNhanhCustomFilterModalOpen] = useState(false);
  const [nhanhFilterType, setNhanhFilterType] = useState<number | null>(null);
  const [nhanhFilterDateFrom, setNhanhFilterDateFrom] = useState("");
  const [nhanhFilterDateTo, setNhanhFilterDateTo] = useState("");
  const [nhanhSavedFilters, setNhanhSavedFilters] = useState<Array<{name: string; type: number | null; dateFrom: string; dateTo: string}>>([]);
  const [nhanhFilterName, setNhanhFilterName] = useState("");
  const limit = 50;

  // Load saved filters from localStorage
  useEffect(() => {
    // Load Shopify filters
    const saved = localStorage.getItem("shopify_pull_filters");
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved filters:", e);
      }
    }

    // Load Nhanh saved filter presets (manual save only)
    const nhanhSaved = localStorage.getItem("nhanh_saved_filters");
    if (nhanhSaved) {
      try {
        setNhanhSavedFilters(JSON.parse(nhanhSaved));
      } catch (e) {
        console.error("Failed to load Nhanh saved filters:", e);
      }
    }
  }, []);

  // Load customers and mappings
  useEffect(() => {
    loadData();
  }, [page, keyword, filter]);

  async function loadData() {
    try {
      setLoading(true);
      
      // Load customers from local database
      console.log("Loading customers from database...", { page, limit, keyword, filter });
      const params: any = { page, limit };
      if (keyword && keyword.trim()) {
        params.keyword = keyword.trim();
      }
      
      // Apply filter based on selection
      if (filter === "mapped") {
        params.mappingStatus = "mapped";
      } else if (filter === "unmapped") {
        params.mappingStatus = "unmapped";
      } else if (filter !== "all") {
        // pending, synced, failed
        params.syncStatus = filter;
      }
      
      const nhanhData = await nhanhClient.getLocalCustomers(params);
      
      console.log("Loaded customers:", {
        count: nhanhData.customers.length,
        total: nhanhData.total,
        totalPages: nhanhData.totalPages,
      });
      
      setCustomers(nhanhData.customers);
      setTotal(nhanhData.total);
      setTotalPages(nhanhData.totalPages);

      // Load mappings only for current page customers (more efficient)
      const customerIds = nhanhData.customers.map(c => c.id);
      const mappingsData = await syncClient.getMappingsByCustomerIds(customerIds);
      const mappingsMap = new Map<string, CustomerMappingData>();
      let syncedCounter = 0;
      mappingsData.forEach((m) => {
        mappingsMap.set(m.nhanhCustomerId, m);
        if (m.syncStatus === SyncStatus.SYNCED) {
          syncedCounter++;
        }
      });
      setMappings(mappingsMap);
      
      // Get total synced count separately
      const stats = await syncClient.getMappingStats();
      setSyncedCount(stats.synced);
    } catch (error: any) {
      console.error("Error loading data:", error);
      alert("Failed to load data: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePullCustomers() {
    if (!confirm("Pull 5,000 customers from Nhanh.vn? This will take ~5 minutes.")) {
      return;
    }

    try {
      setPulling(true);
      const result = await nhanhClient.pullCustomers();
      alert(
        `Pull completed!\n` +
        `Total: ${result.total}\n` +
        `Created: ${result.created}\n` +
        `Updated: ${result.updated}`
      );
      // Reload data after pull
      setPage(1);
      await loadData();
    } catch (error: any) {
      console.error("Error pulling customers:", error);
      alert("Failed to pull customers: " + error.message);
    } finally {
      setPulling(false);
    }
  }

  async function handlePullIncremental() {
    // Check if filters are active
    const hasFilters = nhanhFilterType !== null || nhanhFilterDateFrom || nhanhFilterDateTo;
    
    if (hasFilters) {
      alert(
        "⚠️ Cannot use Pull New/Updated with filters!\n\n" +
        "Pull New/Updated is designed for daily updates of ALL customers.\n\n" +
        "To pull with filters, please use:\n" +
        "• 'Pull All Customers' (pulls all matching filters)\n" +
        "• 'Pull with Custom Filters' (advanced filtering)\n\n" +
        "Or clear your filters first."
      );
      return;
    }
    
    if (!confirm("Pull only new/updated customers?\n\nThis is faster and recommended for daily updates.")) {
      return;
    }

    try {
      setPulling(true);
      const response = await fetch("/api/nhanh/pull-customers-incremental", {
        method: "POST",
      });
      const result = await response.json();
      
      if (result.success) {
        alert(
          `Incremental pull completed!\n\n` +
          `Total processed: ${result.data.total}\n` +
          `New: ${result.data.created}\n` +
          `Updated: ${result.data.updated}`
        );
        setPage(1);
        await loadData();
      } else {
        throw new Error(result.error || "Failed");
      }
    } catch (error: any) {
      console.error("Error in incremental pull:", error);
      alert("Failed to pull customers: " + error.message);
    } finally {
      setPulling(false);
    }
  }

  function handleSelectCustomer(customerId: string) {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  }

  function handleSelectAll() {
    if (selectedCustomers.size === customers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(customers.map((c) => c.id)));
    }
  }

  function openMappingModal(customer: NhanhCustomer) {
    setCurrentCustomer(customer);
    setMappingModalOpen(true);
  }

  async function handleMappingComplete() {
    setMappingModalOpen(false);
    setCurrentCustomer(null);
    await loadData();
  }

  async function handleSync(customerId: string) {
    const mapping = mappings.get(customerId);
    if (!mapping) {
      alert("Please map this customer first");
      return;
    }

    try {
      setSyncing(new Set(syncing).add(customerId));
      await syncClient.syncCustomer(mapping.id);
      await loadData();
      alert("Customer synced successfully!");
    } catch (error: any) {
      console.error("Error syncing customer:", error);
      alert("Failed to sync: " + error.message);
    } finally {
      const newSyncing = new Set(syncing);
      newSyncing.delete(customerId);
      setSyncing(newSyncing);
    }
  }

  async function handleDeleteMapping(customerId: string) {
    const mapping = mappings.get(customerId);
    if (!mapping) {
      alert("No mapping found for this customer");
      return;
    }

    if (!confirm("Delete this mapping?\n\nThis will remove the connection between Nhanh and Shopify customer. You can re-map them later.")) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/sync/mapping?id=${mapping.id}`, {
        method: "DELETE",
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert("Mapping deleted successfully!");
        await loadData();
      } else {
        throw new Error(result.error || "Failed to delete mapping");
      }
    } catch (error: any) {
      console.error("Error deleting mapping:", error);
      alert("Failed to delete mapping: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePullAllCustomers() {
    if (!confirm("Pull ALL customers from Nhanh.vn in background?\n\nThis will continue running even if you close this page. Check the console logs for progress.")) {
      return;
    }

    try {
      // Pass empty filters to pull all customers
      const response = await fetch("/api/nhanh/pull-customers-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Empty filters = pull all
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(
          "Background pull started!\n\n" +
          result.message +
          "\n\nCheck the server console logs for progress."
        );
      } else {
        throw new Error(result.error || "Failed to start background pull");
      }
    } catch (error: any) {
      console.error("Error starting background pull:", error);
      alert("Failed to start background pull: " + error.message);
    }
  }

  async function handlePullShopifyCustomers(query?: string) {
    const filterMessage = query ? ` with filter: "${query}"` : "";
    if (!confirm(`Pull Shopify customers${filterMessage} in background?\n\n⚡ This will run in background and continue even if you close this page.\n\nCheck the server console logs for progress.`)) {
      return;
    }

    try {
      setPulling(true);
      const result = await shopifyClient.pullCustomers(query);
      alert(result?.message || "Background pull started! Check server logs for progress.");
      setPage(1);
      await loadData();
    } catch (error: any) {
      console.error("Error pulling Shopify customers:", error);
      alert("Failed to start pull: " + error.message);
    } finally {
      setPulling(false);
      setShopifyPullDropdownOpen(false);
    }
  }

  function handleSaveFilter(filter: string) {
    if (!filter.trim()) return;
    
    const updated = [...new Set([...savedFilters, filter.trim()])];
    setSavedFilters(updated);
    localStorage.setItem("shopify_pull_filters", JSON.stringify(updated));
  }

  function handleDeleteFilter(filter: string) {
    const updated = savedFilters.filter(f => f !== filter);
    setSavedFilters(updated);
    localStorage.setItem("shopify_pull_filters", JSON.stringify(updated));
  }

  function handleSaveNhanhFilter() {
    if (!nhanhFilterName.trim()) {
      alert("Please enter a filter name");
      return;
    }

    const newFilter = {
      name: nhanhFilterName.trim(),
      type: nhanhFilterType,
      dateFrom: nhanhFilterDateFrom,
      dateTo: nhanhFilterDateTo,
    };

    const updated = [...nhanhSavedFilters, newFilter];
    setNhanhSavedFilters(updated);
    localStorage.setItem("nhanh_saved_filters", JSON.stringify(updated));
    setNhanhFilterName("");
    alert(`Filter "${newFilter.name}" saved!`);
  }

  function handleLoadNhanhFilter(filter: {name: string; type: number | null; dateFrom: string; dateTo: string}) {
    setNhanhFilterType(filter.type);
    setNhanhFilterDateFrom(filter.dateFrom);
    setNhanhFilterDateTo(filter.dateTo);
  }

  function handleDeleteNhanhFilter(filterName: string) {
    const updated = nhanhSavedFilters.filter(f => f.name !== filterName);
    setNhanhSavedFilters(updated);
    localStorage.setItem("nhanh_saved_filters", JSON.stringify(updated));
  }

  function handleCustomFilterSubmit() {
    if (!customFilterInput.trim()) {
      alert("Please enter a filter query");
      return;
    }
    
    setCustomFilterModalOpen(false);
    handlePullShopifyCustomers(customFilterInput.trim());
    setCustomFilterInput("");
  }

  async function handleAutoMatch() {
    if (!confirm("Auto-match unmapped customers by phone number?\n\n⚡ Optimized batch processing for large datasets (200k+)\n\nMatches by:\n• Primary phone\n• Default address phone\n• Phone numbers in notes\n\nThis will create mappings automatically for 1-to-1 matches only.")) {
      return;
    }

    try {
      setLoading(true);
      
      // Use batch method - optimized for large datasets with 3 phone sources
      const result = await syncClient.autoMatchBatch(false);
      
      await loadData();
      
      const durationText = result.duration ? `\nDuration: ${result.duration}` : "";
      const speedText = result.duration 
        ? `\nSpeed: ${Math.round(result.total / parseFloat(result.duration))} customers/sec`
        : "";
      
      alert(
        `Auto-match completed!${durationText}${speedText}\n\nTotal: ${result.total}\nMatched: ${result.matched}\nSkipped: ${result.skipped}`
      );
    } catch (error: any) {
      console.error("Error auto-matching:", error);
      alert("Failed to auto-match: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkSync() {
    try {
      setLoading(true);
      
      // If selected customers > current page, need to fetch all mappings
      const selectedCustomerIds = Array.from(selectedCustomers);
      let mappingIds: string[];
      
      if (selectedCustomerIds.length > customers.length) {
        // Selected across multiple pages - fetch all mappings
        console.log(`Fetching mappings for ${selectedCustomerIds.length} selected customers...`);
        const allMappings = await syncClient.getMappingsByCustomerIds(selectedCustomerIds);
        mappingIds = allMappings
          .map((m) => m.id)
          .filter((id): id is string => !!id);
      } else {
        // Selected only from current page - use cached mappings
        mappingIds = selectedCustomerIds
          .map((id) => mappings.get(id)?.id)
          .filter((id): id is string => !!id);
      }

      if (mappingIds.length === 0) {
        alert("Please select mapped customers to sync");
        setLoading(false);
        return;
      }

      const estimatedTime = Math.ceil(mappingIds.length / 5 * 1 / 60); // ~5 customers/batch, 1s delay (balanced for Shopify rate limits)

      if (!confirm(
        `Sync ${mappingIds.length} customers in background?\n\n` +
        `⚡ Estimated time: ~${estimatedTime} minutes\n\n` +
        `The process will continue in background. Check server logs for progress.`
      )) {
        setLoading(false);
        return;
      }
      
      // Always use background sync - works for all sizes
      const result = await syncClient.bulkSyncBackground(mappingIds);
      alert(
        `Background sync started for ${mappingIds.length} customers!\n\n` +
        `Estimated time: ~${estimatedTime} minutes\n\n` +
        `Check server logs for progress. You can continue using the app.`
      );
      
      setSelectedCustomers(new Set());
      await loadData();
    } catch (error: any) {
      console.error("Error bulk syncing:", error);
      alert("Failed to bulk sync: " + error.message);
    } finally {
      setLoading(false);
    }
  }



  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  }

  // Generate page numbers for pagination
  function getPageNumbers() {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // Maximum number of page buttons to show
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (page > 3) {
        pages.push("...");
      }
      
      // Show pages around current page
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (page < totalPages - 2) {
        pages.push("...");
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header Actions */}
      <div className="border-b border-gray-200 p-6 dark:border-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Nhanh.vn Customers
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {total} customers
            </p>
          </div>

          <div className="flex gap-3">
            {/* Pull Nhanh Customers Dropdown */}
            <div className="relative">
              <button
                onClick={() => setPullDropdownOpen(!pullDropdownOpen)}
                disabled={loading || pulling}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-500 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 shadow-theme-xs hover:bg-brand-100 disabled:opacity-50 dark:border-brand-600 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-900/30"
              >
                {pulling ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600"></div>
                    Pulling...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Pull Nhanh Customers
                  </>
                )}
                <svg className={`h-4 w-4 transition-transform ${pullDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {pullDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setPullDropdownOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          handlePullIncremental();
                          setPullDropdownOpen(false);
                        }}
                        disabled={loading || pulling || nhanhFilterType !== null || !!nhanhFilterDateFrom || !!nhanhFilterDateTo}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300 dark:hover:bg-gray-700"
                        title={
                          (nhanhFilterType !== null || nhanhFilterDateFrom || nhanhFilterDateTo)
                            ? "Cannot use with filters - use 'Pull All Customers' or 'Pull with Custom Filters' instead"
                            : "Pull only new/updated customers (recommended for daily updates)"
                        }
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <div className="flex-1 text-left">
                          <div>Pull New/Updated</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {(nhanhFilterType !== null || nhanhFilterDateFrom || nhanhFilterDateTo)
                              ? "Not available with filters"
                              : "Daily updates (fastest)"}
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          handlePullAllCustomers();
                          setPullDropdownOpen(false);
                        }}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                        title="Pull all customers in background (auto-resume)"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <div className="flex-1 text-left">
                          <div>Pull All (Background)</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Full sync, auto-resume</div>
                        </div>
                      </button>

                      <div className="border-t border-gray-200 dark:border-gray-700"></div>
                      
                      <button
                        onClick={() => {
                          setNhanhCustomFilterModalOpen(true);
                          setPullDropdownOpen(false);
                        }}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        <div className="flex-1 text-left">
                          <div>Advanced Filters</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Filter by type & date</div>
                        </div>
                      </button>

                      <div className="border-t border-gray-200 dark:border-gray-700"></div>
                      
                      <button
                        onClick={async () => {
                          if (confirm("Reset pull progress and start from beginning?")) {
                            try {
                              const response = await fetch("/api/nhanh/reset-pull-progress?type=customers", {
                                method: "POST",
                              });
                              const result = await response.json();
                              alert(result.message);
                            } catch (error: any) {
                              alert("Failed to reset: " + error.message);
                            }
                          }
                          setPullDropdownOpen(false);
                        }}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <div className="flex-1 text-left">
                          <div>Reset Pull Progress</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Start from beginning</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Pull Shopify Customers Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShopifyPullDropdownOpen(!shopifyPullDropdownOpen)}
                disabled={loading || pulling}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
              >
                {pulling ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                    Pulling...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Pull Shopify Customers
                  </>
                )}
                <svg className={`h-4 w-4 transition-transform ${shopifyPullDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {shopifyPullDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShopifyPullDropdownOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <div className="py-1">
                      <button
                        onClick={() => handlePullShopifyCustomers()}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <div className="flex-1 text-left">
                          <div>All Customers</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Pull all customers</div>
                        </div>
                      </button>

                      <button
                        onClick={() => handlePullShopifyCustomers("state:ENABLED")}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <div className="flex-1 text-left">
                          <div>Customers with Accounts</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Only registered customers</div>
                        </div>
                      </button>

                      <button
                        onClick={() => handlePullShopifyCustomers("orders_count:>0")}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <div className="flex-1 text-left">
                          <div>Customers with Orders</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Has at least 1 order</div>
                        </div>
                      </button>

                      <button
                        onClick={() => handlePullShopifyCustomers("email:*")}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <div className="flex-1 text-left">
                          <div>Customers with Email</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Has email address</div>
                        </div>
                      </button>

                      {/* Saved Filters */}
                      {savedFilters.length > 0 && (
                        <>
                          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                          <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                            Saved Filters
                          </div>
                          {savedFilters.map((filter, index) => (
                            <div key={index} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700">
                              <button
                                onClick={() => handlePullShopifyCustomers(filter)}
                                disabled={loading || pulling}
                                className="flex-1 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 text-left"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                                <div className="flex-1 truncate">
                                  <div className="text-xs font-mono">{filter}</div>
                                </div>
                              </button>
                              <button
                                onClick={() => handleDeleteFilter(filter)}
                                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                title="Delete filter"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Reset & Custom Filter */}
                      <div className="border-t border-gray-200 dark:border-gray-700"></div>
                      
                      <button
                        onClick={async () => {
                          if (confirm("Reset Shopify pull progress and start from beginning?")) {
                            try {
                              const response = await fetch("/api/shopify/reset-pull-progress", {
                                method: "POST",
                              });
                              const result = await response.json();
                              alert(result.message || "Progress reset successfully");
                            } catch (error: any) {
                              alert("Failed to reset: " + error.message);
                            }
                          }
                          setShopifyPullDropdownOpen(false);
                        }}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <div className="flex-1 text-left">
                          <div>Reset Pull Progress</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Start from beginning</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setCustomFilterModalOpen(true);
                          setShopifyPullDropdownOpen(false);
                        }}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <div className="flex-1 text-left">
                          <div>Custom Filter</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Enter your own query</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* More Actions Dropdown */}
            <div className="relative">
              <button
                onClick={() => setMoreActionsOpen(!moreActionsOpen)}
                disabled={loading || pulling}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                More Actions
                <svg className={`h-4 w-4 transition-transform ${moreActionsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {moreActionsOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setMoreActionsOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setPage(1);
                          loadData();
                          setMoreActionsOpen(false);
                        }}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>

                      <button
                        onClick={() => {
                          handleAutoMatch();
                          setMoreActionsOpen(false);
                        }}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Auto Match
                      </button>

                      <button
                        onClick={() => {
                          setAutoSyncModalOpen(true);
                          setMoreActionsOpen(false);
                        }}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Auto Sync Settings
                      </button>

                      <div className="border-t border-gray-200 dark:border-gray-700"></div>

                      <button
                        onClick={async () => {
                          if (confirm("Retry all failed syncs?\n\nThis will retry customers that failed due to rate limits or other errors.")) {
                            try {
                              setLoading(true);
                              const response = await fetch("/api/sync/retry-failed", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ limit: 100 }),
                              });
                              const result = await response.json();
                              if (result.success) {
                                alert(result.data.message);
                                await loadData();
                              } else {
                                throw new Error(result.error);
                              }
                            } catch (error: any) {
                              alert("Failed to retry: " + error.message);
                            } finally {
                              setLoading(false);
                            }
                          }
                          setMoreActionsOpen(false);
                        }}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-orange-700 hover:bg-orange-50 disabled:opacity-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Retry Failed Syncs
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {selectedCustomers.size > 0 && (
              <button
                onClick={handleBulkSync}
                disabled={loading || pulling}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Selected ({selectedCustomers.size})
              </button>
            )}
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="mt-4 flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pl-10 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
            <svg
              className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {filter === "all" ? "All Customers" : 
               filter === "mapped" ? "Mapped" :
               filter === "unmapped" ? "Unmapped" :
               filter === "pending" ? "Pending" :
               filter === "synced" ? "Synced" : "Failed"}
              <svg className={`h-4 w-4 transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {filterDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setFilterDropdownOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setFilter("all");
                        setPage(1);
                        setFilterDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        filter === "all" ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {filter === "all" && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={filter !== "all" ? "ml-7" : ""}>All Customers</span>
                    </button>

                    <button
                      onClick={() => {
                        setFilter("mapped");
                        setPage(1);
                        setFilterDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        filter === "mapped" ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {filter === "mapped" && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={filter !== "mapped" ? "ml-7" : ""}>Mapped</span>
                    </button>

                    <button
                      onClick={() => {
                        setFilter("unmapped");
                        setPage(1);
                        setFilterDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        filter === "unmapped" ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {filter === "unmapped" && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={filter !== "unmapped" ? "ml-7" : ""}>Unmapped</span>
                    </button>

                    <button
                      onClick={() => {
                        setFilter("pending");
                        setPage(1);
                        setFilterDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        filter === "pending" ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {filter === "pending" && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={filter !== "pending" ? "ml-7" : ""}>Pending</span>
                    </button>

                    <button
                      onClick={() => {
                        setFilter("synced");
                        setPage(1);
                        setFilterDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        filter === "synced" ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {filter === "synced" && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={filter !== "synced" ? "ml-7" : ""}>Synced</span>
                    </button>

                    <button
                      onClick={() => {
                        setFilter("failed");
                        setPage(1);
                        setFilterDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        filter === "failed" ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {filter === "failed" && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={filter !== "failed" ? "ml-7" : ""}>Failed</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-gray-100 dark:border-gray-800 border-y bg-gray-50 dark:bg-gray-900">
            <TableRow>
              <TableCell isHeader className="w-12">
                <div className="relative">
                  <Checkbox
                    checked={selectedCustomers.size === customers.length && customers.length > 0}
                    onChange={() => setSelectDropdownOpen(!selectDropdownOpen)}
                  />
                  
                  {selectDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setSelectDropdownOpen(false)}
                      />
                      <div className="absolute left-0 z-20 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setSelectedCustomers(new Set(customers.map((c) => c.id)));
                              setSelectDropdownOpen(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Select all on this page ({customers.length})
                          </button>

                          <button
                            onClick={async () => {
                              if (confirm(`Select all ${total} customers across all pages?`)) {
                                try {
                                  setLoading(true);
                                  // Fetch all customer IDs
                                  const params: any = { page: 1, limit: total };
                                  if (keyword) params.keyword = keyword;
                                  if (filter === "mapped" || filter === "unmapped") {
                                    params.mappingStatus = filter;
                                  } else if (filter !== "all") {
                                    params.syncStatus = filter;
                                  }
                                  const allCustomers = await nhanhClient.getLocalCustomers(params);
                                  setSelectedCustomers(new Set(allCustomers.customers.map((c: any) => c.id)));
                                  setSelectDropdownOpen(false);
                                } catch (error) {
                                  console.error("Error selecting all:", error);
                                  alert("Failed to select all customers");
                                } finally {
                                  setLoading(false);
                                }
                              }
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/20"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Select all {total} customers
                          </button>

                          <button
                            onClick={() => {
                              setSelectedCustomers(new Set());
                              setSelectDropdownOpen(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Unselect all
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell isHeader>Customer</TableCell>
              <TableCell isHeader>Contact</TableCell>
              <TableCell isHeader>Total Spent</TableCell>
              <TableCell isHeader>Status</TableCell>
              <TableCell isHeader>Shopify Customer</TableCell>
              <TableCell isHeader className="text-right">Actions</TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-gray-500">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => {
                const mapping = mappings.get(customer.id);
                const isSyncing = syncing.has(customer.id);

                return (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedCustomers.has(customer.id)}
                        onChange={() => handleSelectCustomer(customer.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white/90">
                          {customer.name}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          ID: {customer.id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        {customer.phone && (
                          <p className="text-gray-700 dark:text-gray-300">{customer.phone}</p>
                        )}
                        {customer.email && (
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{customer.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-gray-800 dark:text-white/90">
                        {formatCurrency(customer.totalSpent)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <SyncStatusBadge
                        status={mapping?.syncStatus || SyncStatus.UNMAPPED}
                      />
                    </TableCell>
                    <TableCell>
                      {mapping?.shopifyCustomerId ? (
                        <div>
                          <p className="text-gray-700 dark:text-gray-300">
                            {mapping.shopifyCustomerName || "Unknown"}
                          </p>
                          {mapping.shopifyCustomerEmail && (
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {mapping.shopifyCustomerEmail}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Not mapped</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {!mapping || !mapping.shopifyCustomerId ? (
                          <button
                            onClick={() => openMappingModal(customer)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            Map
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDeleteMapping(customer.id)}
                              disabled={loading}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-danger-300 bg-white px-3 py-1.5 text-xs font-medium text-danger-700 hover:bg-danger-50 disabled:opacity-50 dark:border-danger-700 dark:bg-gray-800 dark:text-danger-400 dark:hover:bg-danger-900/20"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                            <button
                              onClick={() => handleSync(customer.id)}
                              disabled={isSyncing}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-success-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-600 disabled:opacity-50"
                            >
                              {isSyncing ? (
                                <>
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                                  Syncing...
                                </>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Sync
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {customers.length > 0 && totalPages > 0 && (
        <div className="flex flex-col gap-4 border-t border-gray-200 px-6 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing <span className="font-medium text-gray-700 dark:text-gray-300">{(page - 1) * limit + 1}</span> to{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {Math.min(page * limit, total)}
            </span>{" "}
            of <span className="font-medium text-gray-700 dark:text-gray-300">{total}</span> customers
          </div>
          
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || loading || pulling}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>

            {/* Page Numbers */}
            <div className="hidden items-center gap-1 sm:flex">
              {getPageNumbers().map((pageNum, index) => {
                if (pageNum === "...") {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
                    >
                      ...
                    </span>
                  );
                }
                
                const isActive = pageNum === page;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum as number)}
                    disabled={loading || pulling}
                    className={`min-w-[40px] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-brand-500 text-white hover:bg-brand-600"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Mobile: Current Page Indicator */}
            <div className="flex items-center gap-2 sm:hidden">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {page} of {totalPages}
              </span>
            </div>

            {/* Next Button */}
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages || loading || pulling}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              Next
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Mapping Modal */}
      {currentCustomer && (
        <MappingModal
          isOpen={mappingModalOpen}
          onClose={() => setMappingModalOpen(false)}
          customer={currentCustomer}
          existingMapping={mappings.get(currentCustomer.id)}
          onMappingComplete={handleMappingComplete}
        />
      )}

      {/* Auto Sync Settings Modal */}
      <GlobalAutoSyncSettings
        isOpen={autoSyncModalOpen}
        onClose={() => setAutoSyncModalOpen(false)}
        syncedCount={syncedCount}
      />

      {/* Custom Filter Modal */}
      <Modal
        isOpen={customFilterModalOpen}
        onClose={() => {
          setCustomFilterModalOpen(false);
          setCustomFilterInput("");
        }}
        className="max-w-2xl"
      >
        <div className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white">
            Custom Shopify Filter
          </h3>

          <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filter Query
                </label>
                <input
                  type="text"
                  value={customFilterInput}
                  onChange={(e) => setCustomFilterInput(e.target.value)}
                  placeholder="e.g. state:ENABLED AND orders_count:>5"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCustomFilterSubmit();
                    }
                  }}
                />
              </div>

              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Common Filters:
                </h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 font-mono">
                  <div>• <span className="text-brand-600 dark:text-brand-400">state:ENABLED</span> - Customers with accounts</div>
                  <div>• <span className="text-brand-600 dark:text-brand-400">orders_count:&gt;0</span> - Has at least 1 order</div>
                  <div>• <span className="text-brand-600 dark:text-brand-400">email:*</span> - Has email address</div>
                  <div>• <span className="text-brand-600 dark:text-brand-400">phone:*</span> - Has phone number</div>
                  <div>• <span className="text-brand-600 dark:text-brand-400">tag:VIP</span> - Has "VIP" tag</div>
                  <div>• <span className="text-brand-600 dark:text-brand-400">created_at:&gt;2024-01-01</span> - Created after date</div>
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    Combine with <span className="text-brand-600 dark:text-brand-400">AND</span> / <span className="text-brand-600 dark:text-brand-400">OR</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (customFilterInput.trim()) {
                      handleSaveFilter(customFilterInput.trim());
                      alert("Filter saved!");
                    }
                  }}
                  disabled={!customFilterInput.trim()}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Save Filter
                </button>

                <div className="flex-1"></div>

                <button
                  onClick={() => {
                    setCustomFilterModalOpen(false);
                    setCustomFilterInput("");
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>

                <button
                  onClick={handleCustomFilterSubmit}
                  disabled={!customFilterInput.trim()}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  Pull Customers
                </button>
              </div>
            </div>
          </div>
      </Modal>

      {/* Nhanh Advanced Filter Modal */}
      <Modal
        isOpen={nhanhCustomFilterModalOpen}
        onClose={() => {
          setNhanhCustomFilterModalOpen(false);
          setNhanhFilterType(null);
          setNhanhFilterDateFrom("");
          setNhanhFilterDateTo("");
        }}
        className="max-w-2xl"
      >
        <div className="p-6">
          <h3 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white">
            Nhanh.vn Advanced Filters
          </h3>

          <div className="space-y-5">
            {/* Customer Type Select */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Customer Type
              </label>
              <div className="relative">
                <select
                  value={nhanhFilterType || ""}
                  onChange={(e) => setNhanhFilterType(e.target.value ? parseInt(e.target.value) : null)}
                  className={`h-11 w-full appearance-none rounded-lg border border-gray-300 px-4 py-2.5 pr-11 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 ${
                    nhanhFilterType
                      ? "text-gray-800 dark:text-white/90"
                      : "text-gray-400 dark:text-gray-400"
                  }`}
                >
                  <option value="" className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">
                    All Types
                  </option>
                  <option value="1" className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">
                    Khách lẻ (Retail)
                  </option>
                  <option value="2" className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">
                    Khách sỉ (Wholesale)
                  </option>
                  <option value="3" className="text-gray-700 dark:bg-gray-900 dark:text-gray-400">
                    Đại lý (Agent)
                  </option>
                </select>
                <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Last Bought From
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={nhanhFilterDateFrom}
                    onChange={(e) => setNhanhFilterDateFrom(e.target.value)}
                    className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800"
                    placeholder="Select date"
                  />
                  <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Last Bought To
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={nhanhFilterDateTo}
                    onChange={(e) => setNhanhFilterDateTo(e.target.value)}
                    className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800"
                    placeholder="Select date"
                  />
                  <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>

            {/* Save Filter Preset */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Filter Preset
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nhanhFilterName}
                  onChange={(e) => setNhanhFilterName(e.target.value)}
                  placeholder="Enter filter name (e.g., Retail Nov 2024)"
                  className="flex-1 h-10 rounded-lg border appearance-none px-3 py-2 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-2 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-white text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-600 dark:focus:border-brand-800"
                />
                <button
                  onClick={handleSaveNhanhFilter}
                  disabled={!nhanhFilterName.trim() || (nhanhFilterType === null && !nhanhFilterDateFrom && !nhanhFilterDateTo)}
                  className="h-10 rounded-lg bg-gray-700 px-4 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-600 dark:hover:bg-gray-700"
                >
                  Save
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Save current filters for quick access later
              </p>
            </div>

            {/* Saved Filter Presets */}
            {nhanhSavedFilters.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Saved Filters ({nhanhSavedFilters.length})
                </h4>
                <div className="space-y-2">
                  {nhanhSavedFilters.map((filter, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <button
                        onClick={() => handleLoadNhanhFilter(filter)}
                        className="flex-1 text-left text-sm"
                      >
                        <div className="font-medium text-gray-800 dark:text-gray-200">{filter.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {filter.type && `Type: ${filter.type === 1 ? 'Khách lẻ' : filter.type === 2 ? 'Khách sỉ' : 'Đại lý'}`}
                          {filter.type && (filter.dateFrom || filter.dateTo) && ' • '}
                          {filter.dateFrom && `From: ${filter.dateFrom}`}
                          {filter.dateFrom && filter.dateTo && ' • '}
                          {filter.dateTo && `To: ${filter.dateTo}`}
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete filter "${filter.name}"?`)) {
                            handleDeleteNhanhFilter(filter.name);
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete filter"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                    Filter Examples
                  </h4>
                  <div className="space-y-1.5 text-xs text-blue-800 dark:text-blue-300/90">
                    <div>• <strong>Type only:</strong> Pull all retail/wholesale/agent customers</div>
                    <div>• <strong>From only:</strong> Pull customers who bought since that date</div>
                    <div>• <strong>To only:</strong> Pull customers who bought before that date</div>
                    <div>• <strong>From + To:</strong> Pull customers who bought in date range</div>
                    <div>• <strong>Type + Date:</strong> Combine filters for specific segment</div>
                    <div className="mt-2.5 pt-2.5 border-t border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 flex items-start gap-1.5">
                      <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span><strong>Tip:</strong> Use any combination of filters or leave all empty to pull all customers</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              {/* Clear Filters Button */}
              {(nhanhFilterType !== null || nhanhFilterDateFrom || nhanhFilterDateTo) && (
                <button
                  onClick={() => {
                    setNhanhFilterType(null);
                    setNhanhFilterDateFrom("");
                    setNhanhFilterDateTo("");
                  }}
                  className="h-11 rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-500 shadow-theme-xs transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                >
                  Clear Filters
                </button>
              )}
              
              <div className="flex items-center gap-3 ml-auto">
                <button
                  onClick={() => {
                    setNhanhCustomFilterModalOpen(false);
                    setNhanhFilterType(null);
                    setNhanhFilterDateFrom("");
                    setNhanhFilterDateTo("");
                  }}
                  className="h-11 rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>

              <button
                onClick={async () => {
                  const filterMessage = [];
                  if (nhanhFilterType) {
                    const typeNames = { 1: "Khách lẻ", 2: "Khách sỉ", 3: "Đại lý" };
                    filterMessage.push(`Type: ${typeNames[nhanhFilterType as keyof typeof typeNames]}`);
                  }
                  if (nhanhFilterDateFrom) filterMessage.push(`From: ${nhanhFilterDateFrom}`);
                  if (nhanhFilterDateTo) filterMessage.push(`To: ${nhanhFilterDateTo}`);
                  
                  const message = filterMessage.length > 0 
                    ? `Pull with filters:\n${filterMessage.join("\n")}`
                    : "Pull all customers";
                  
                  if (!confirm(`${message}\n\n✅ Nhanh API supports these filters!\nFilters will be applied during pull.\n\nThis will run in background. Continue?`)) {
                    return;
                  }

                  try {
                    setPulling(true);
                    setNhanhCustomFilterModalOpen(false);
                    
                    // Pass filters to API (no auto-save, only manual save via presets)
                    const filters: any = {};
                    if (nhanhFilterType) filters.type = nhanhFilterType;
                    if (nhanhFilterDateFrom) filters.lastBoughtDateFrom = nhanhFilterDateFrom;
                    if (nhanhFilterDateTo) filters.lastBoughtDateTo = nhanhFilterDateTo;
                    
                    const response = await fetch("/api/nhanh/pull-customers-all", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(filters),
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                      let alertMessage = "✅ Background pull started!\n\n";
                      alertMessage += result.message + "\n\n";
                      
                      if (filterMessage.length > 0) {
                        alertMessage += "🎯 Filters applied:\n";
                        alertMessage += filterMessage.join("\n") + "\n\n";
                        alertMessage += "Only matching customers will be pulled.";
                      }
                      
                      alert(alertMessage);
                    } else {
                      throw new Error(result.error || "Failed to start pull");
                    }
                  } catch (error: any) {
                    alert("Failed to start pull: " + error.message);
                  } finally {
                    setPulling(false);
                    setNhanhFilterType(null);
                    setNhanhFilterDateFrom("");
                    setNhanhFilterDateTo("");
                  }
                }}
                disabled={pulling}
                className="h-11 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pulling ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Pulling...
                  </span>
                ) : (
                  "Pull Customers"
                )}
              </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
