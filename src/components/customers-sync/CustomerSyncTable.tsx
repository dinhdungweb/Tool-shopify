"use client";

import { useEffect, useState } from "react";
import { nhanhClient, syncClient, shopifyClient } from "@/lib/api-client";
import { NhanhCustomer } from "@/types/nhanh";
import { CustomerMappingData, SyncStatus } from "@/types/mapping";
import SyncStatusBadge from "./SyncStatusBadge";
import MappingModal from "./MappingModal";
import GlobalAutoSyncSettings from "./GlobalAutoSyncSettings";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";
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
  const [mappingFilter, setMappingFilter] = useState<"all" | "mapped" | "unmapped">("all");
  const [syncedCount, setSyncedCount] = useState(0);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const limit = 50;

  // Load customers and mappings
  useEffect(() => {
    loadData();
  }, [page, keyword, mappingFilter]);

  async function loadData() {
    try {
      setLoading(true);
      
      // Load customers from local database
      console.log("Loading customers from database...", { page, limit, keyword, mappingFilter });
      const params: any = { page, limit };
      if (keyword && keyword.trim()) {
        params.keyword = keyword.trim();
      }
      if (mappingFilter !== "all") {
        params.mappingStatus = mappingFilter;
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

      // Load existing mappings
      const mappingsData = await syncClient.getMappings({ page: 1, limit: 10000 });
      const mappingsMap = new Map<string, CustomerMappingData>();
      let syncedCounter = 0;
      mappingsData.mappings.forEach((m) => {
        mappingsMap.set(m.nhanhCustomerId, m);
        if (m.syncStatus === SyncStatus.SYNCED) {
          syncedCounter++;
        }
      });
      setMappings(mappingsMap);
      setSyncedCount(syncedCounter);
    } catch (error: any) {
      console.error("Error loading data:", error);
      alert("Failed to load data: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePullCustomers() {
    if (!confirm("Pull all customers from Nhanh.vn and save to database? This may take a few minutes.")) {
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

  async function handlePullShopifyCustomers() {
    if (!confirm("Pull all Shopify customers to local database?\n\nThis will fetch all customers from Shopify and store them locally for faster matching.")) {
      return;
    }

    try {
      setLoading(true);
      const result = await shopifyClient.pullCustomers();
      
      alert(
        `Pull completed!\n\nTotal: ${result.total}\nCreated: ${result.created}\nUpdated: ${result.updated}\nFailed: ${result.failed}`
      );
    } catch (error: any) {
      console.error("Error pulling Shopify customers:", error);
      alert("Failed to pull Shopify customers: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoMatch() {
    if (!confirm("Auto-match unmapped customers by phone number?\n\nThis will search local Shopify customers database for matching phone numbers and create mappings automatically.")) {
      return;
    }

    try {
      setLoading(true);
      const result = await syncClient.autoMatch(false);
      await loadData();
      
      const details = result.details.filter((d: any) => d.status === "matched");
      const detailsText = details.length > 0 && details.length <= 10
        ? "\n\nMatched:\n" + details.map((d: any) => `- ${d.nhanhCustomer.name} → ${d.shopifyCustomer.name}`).join("\n")
        : "";
      
      alert(
        `Auto-match completed!\n\nTotal: ${result.total}\nMatched: ${result.matched}\nSkipped: ${result.skipped}\nFailed: ${result.failed}${detailsText}`
      );
    } catch (error: any) {
      console.error("Error auto-matching:", error);
      alert("Failed to auto-match: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkSync() {
    const mappingIds = Array.from(selectedCustomers)
      .map((id) => mappings.get(id)?.id)
      .filter((id): id is string => !!id);

    if (mappingIds.length === 0) {
      alert("Please select mapped customers to sync");
      return;
    }

    if (!confirm(`Sync ${mappingIds.length} customers?`)) {
      return;
    }

    try {
      setLoading(true);
      const result = await syncClient.bulkSync(mappingIds);
      await loadData();
      alert(
        `Bulk sync completed!\nSuccessful: ${result.successful}\nFailed: ${result.failed}`
      );
      setSelectedCustomers(new Set());
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
            <button
              onClick={handlePullCustomers}
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
                  Pull from Nhanh.vn
                </>
              )}
            </button>

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
                          handlePullShopifyCustomers();
                          setMoreActionsOpen(false);
                        }}
                        disabled={loading || pulling}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Pull Shopify Customers
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

          <div className="relative">
            <button
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {mappingFilter === "all" ? "All Customers" : mappingFilter === "mapped" ? "Mapped Only" : "Unmapped Only"}
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
                        setMappingFilter("all");
                        setPage(1);
                        setFilterDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        mappingFilter === "all" ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {mappingFilter === "all" && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={mappingFilter !== "all" ? "ml-7" : ""}>All Customers</span>
                    </button>

                    <button
                      onClick={() => {
                        setMappingFilter("mapped");
                        setPage(1);
                        setFilterDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        mappingFilter === "mapped" ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {mappingFilter === "mapped" && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={mappingFilter !== "mapped" ? "ml-7" : ""}>Mapped Only</span>
                    </button>

                    <button
                      onClick={() => {
                        setMappingFilter("unmapped");
                        setPage(1);
                        setFilterDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        mappingFilter === "unmapped" ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {mappingFilter === "unmapped" && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={mappingFilter !== "unmapped" ? "ml-7" : ""}>Unmapped Only</span>
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
                <Checkbox
                  checked={selectedCustomers.size === customers.length && customers.length > 0}
                  onChange={handleSelectAll}
                />
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
                              onClick={() => openMappingModal(customer)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              Remap
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
    </div>
  );
}
