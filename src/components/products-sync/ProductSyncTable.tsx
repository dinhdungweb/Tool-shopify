"use client";

import { useEffect, useState } from "react";
import { productSyncClient } from "@/lib/api-client";
import { ShopifyProduct } from "@/types/product";
import SyncStatusBadge from "../customers-sync/SyncStatusBadge";
import ProductMappingModal from "./ProductMappingModal";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";
import Checkbox from "../form/input/Checkbox";
import { NhanhProduct } from "@prisma/client";

export default function ProductSyncTable() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [mappings, setMappings] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<ShopifyProduct | null>(null);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<"all" | "mapped" | "unmapped" | "pending" | "synced" | "failed">("all");
  const [pullDropdownOpen, setPullDropdownOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const limit = 50;

  useEffect(() => {
    loadData();
  }, [page, keyword, filter]);

  async function loadData() {
    try {
      setLoading(true);
      
      const params: any = { page, limit };
      if (keyword && keyword.trim()) {
        params.keyword = keyword.trim();
      }
      
      if (filter === "mapped") {
        params.mappingStatus = "mapped";
      } else if (filter === "unmapped") {
        params.mappingStatus = "unmapped";
      } else if (filter !== "all") {
        params.syncStatus = filter;
      }
      
      const shopifyData = await productSyncClient.getLocalShopifyProducts(params);
      
      setProducts(shopifyData.products);
      setTotal(shopifyData.total);
      setTotalPages(shopifyData.totalPages);

      const mappingsData = await productSyncClient.getProductMappings({ page: 1, limit: 10000 });
      const mappingsMap = new Map<string, any>();
      mappingsData.mappings.forEach((m) => {
        mappingsMap.set(m.shopifyProductId, m);
      });
      setMappings(mappingsMap);
    } catch (error: any) {
      console.error("Error loading data:", error);
      alert("Failed to load data: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePullShopifyProducts() {
    if (!confirm("Pull all products from Shopify?\n\nThis may take a few minutes.")) {
      return;
    }

    try {
      setPulling(true);
      const result = await productSyncClient.pullShopifyProducts();
      alert(
        `Pull completed!\n\nTotal: ${result.total}\nCreated: ${result.created}\nUpdated: ${result.updated}\nFailed: ${result.failed}`
      );
      setPage(1);
      await loadData();
    } catch (error: any) {
      console.error("Error pulling products:", error);
      alert("Failed to pull products: " + error.message);
    } finally {
      setPulling(false);
    }
  }

  async function handlePullNhanhProducts() {
    if (!confirm("Pull all products from Nhanh.vn?\n\nThis will help speed up product mapping.")) {
      return;
    }

    try {
      setPulling(true);
      const result = await productSyncClient.pullNhanhProducts();
      alert(
        `Pull completed!\n\nTotal: ${result.total}\nCreated: ${result.created}\nUpdated: ${result.updated}`
      );
    } catch (error: any) {
      console.error("Error pulling Nhanh products:", error);
      alert("Failed to pull Nhanh products: " + error.message);
    } finally {
      setPulling(false);
    }
  }

  function handleSelectProduct(productId: string) {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  }

  function openMappingModal(product: NhanhProduct) {
    setCurrentProduct(product);
    setMappingModalOpen(true);
  }

  async function handleMappingComplete() {
    setMappingModalOpen(false);
    setCurrentProduct(null);
    await loadData();
  }

  async function handleSync(productId: string) {
    const mapping = mappings.get(productId);
    if (!mapping) {
      alert("Please map the product first");
      return;
    }

    try {
      setSyncing(new Set(syncing).add(productId));
      await productSyncClient.syncProduct(mapping.id);
      await loadData();
      alert("Inventory synced successfully!");
    } catch (error: any) {
      console.error("Error syncing product:", error);
      alert("Failed to sync: " + error.message);
    } finally {
      const newSyncing = new Set(syncing);
      newSyncing.delete(productId);
      setSyncing(newSyncing);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  }

  function getPageNumbers() {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (page > 3) {
        pages.push("...");
      }
      
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (page < totalPages - 2) {
        pages.push("...");
      }
      
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
              Shopify Products
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {total} products • Sync inventory from Nhanh to Shopify
            </p>
          </div>

          <div className="flex gap-3">
            {/* Pull Shopify Products Button */}
            <button
              onClick={handlePullShopifyProducts}
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
                  Pull Shopify Products
                </>
              )}
            </button>

            {/* Pull Nhanh Products Button */}
            <button
              onClick={handlePullNhanhProducts}
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
                  Pull Nhanh Products
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
                More
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
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="mt-4 flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by title, SKU, or barcode..."
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
              {filter === "all" ? "All" : 
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
                    {[
                      { value: "all", label: "All" },
                      { value: "mapped", label: "Mapped" },
                      { value: "unmapped", label: "Unmapped" },
                      { value: "pending", label: "Pending" },
                      { value: "synced", label: "Synced" },
                      { value: "failed", label: "Failed" },
                    ].map((item) => (
                      <button
                        key={item.value}
                        onClick={() => {
                          setFilter(item.value as any);
                          setPage(1);
                          setFilterDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          filter === item.value ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {filter === item.value && (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span className={filter !== item.value ? "ml-7" : ""}>{item.label}</span>
                      </button>
                    ))}
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
                  checked={selectedProducts.size === products.length && products.length > 0}
                  onChange={() => {
                    if (selectedProducts.size === products.length) {
                      setSelectedProducts(new Set());
                    } else {
                      setSelectedProducts(new Set(products.map((p) => p.id)));
                    }
                  }}
                />
              </TableCell>
              <TableCell isHeader>Shopify Product</TableCell>
              <TableCell isHeader>Nhanh Product</TableCell>
              <TableCell isHeader>Status</TableCell>
              <TableCell isHeader className="text-right">Action</TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-gray-500">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const mapping = mappings.get(product.id);
                const isSyncing = syncing.has(product.id);

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white/90">
                          {product.title}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {product.sku && <span className="inline-flex items-center gap-1">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono dark:bg-gray-800">SKU</span>
                            {product.sku}
                          </span>}
                          {product.id && <span className="inline-flex items-center gap-1">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono dark:bg-gray-800">ID</span>
                            {product.id}
                          </span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {mapping?.nhanhProductId ? (
                        <div>
                          <p className="text-gray-700 dark:text-gray-300">
                            {mapping.nhanhProductName || "Unknown"}
                          </p>
                          {mapping.nhanhSku && (
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              SKU: {mapping.nhanhSku}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Not mapped</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SyncStatusBadge
                        status={mapping?.syncStatus || "UNMAPPED"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {!mapping || !mapping.nhanhProductId ? (
                          <button
                            onClick={() => openMappingModal(product)}
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
                              onClick={() => openMappingModal(product)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              Remap
                            </button>
                            <button
                              onClick={() => handleSync(product.id)}
                              disabled={isSyncing}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-success-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-600 disabled:opacity-50"
                              title="Đồng bộ tồn kho từ Nhanh sang Shopify"
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
      {products.length > 0 && totalPages > 0 && (
        <div className="flex flex-col gap-4 border-t border-gray-200 px-6 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Hiển thị <span className="font-medium text-gray-700 dark:text-gray-300">{(page - 1) * limit + 1}</span> đến{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {Math.min(page * limit, total)}
            </span>{" "}
            trong <span className="font-medium text-gray-700 dark:text-gray-300">{total}</span> sản phẩm
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || loading || pulling}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Trước
            </button>

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

            <div className="flex items-center gap-2 sm:hidden">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Trang {page} / {totalPages}
              </span>
            </div>

            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages || loading || pulling}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              Sau
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Mapping Modal */}
      {currentProduct && (
        <ProductMappingModal
          isOpen={mappingModalOpen}
          onClose={() => setMappingModalOpen(false)}
          product={currentProduct}
          existingMapping={mappings.get(currentProduct.id)}
          onMappingComplete={handleMappingComplete}
        />
      )}
    </div>
  );
}
