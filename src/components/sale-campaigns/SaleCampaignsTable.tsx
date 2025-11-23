"use client";

import { useEffect, useState } from "react";
import { saleClient } from "@/lib/api-client";
import { CampaignStatus } from "@/types/sale";
import CampaignStatusBadge from "./CampaignStatusBadge";
import CreateCampaignModal from "./CreateCampaignModal";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";
import Pagination from "../tables/Pagination";

export default function SaleCampaignsTable() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 20;

  useEffect(() => {
    loadCampaigns();
  }, [page, statusFilter, searchQuery]);

  async function loadCampaigns() {
    try {
      setLoading(true);
      const params: any = { page, limit };
      if (statusFilter !== "all") {
        params.status = statusFilter.toUpperCase();
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const data = await saleClient.getCampaigns(params);
      setCampaigns(data.campaigns);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (error: any) {
      console.error("Error loading campaigns:", error);
      alert("Failed to load campaigns: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(query: string) {
    setSearchQuery(query);
    setPage(1); // Reset to first page when searching
  }

  async function handleApply(campaignId: string, campaignName: string) {
    if (!confirm(`Apply campaign "${campaignName}"?\n\nThis will update prices on Shopify.`)) {
      return;
    }

    try {
      setActionLoadingId(campaignId);
      const result = await saleClient.applyCampaign(campaignId);
      
      // Reload campaigns to show updated status
      await loadCampaigns();
      
      alert(`Campaign applied successfully!\n\n${result.affectedCount} variants updated.`);
    } catch (error: any) {
      console.error("Error applying campaign:", error);
      alert("Failed to apply campaign: " + error.message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRevert(campaignId: string, campaignName: string) {
    if (!confirm(`Revert campaign "${campaignName}"?\n\nThis will restore original prices.`)) {
      return;
    }

    try {
      setActionLoadingId(campaignId);
      const result = await saleClient.revertCampaign(campaignId);
      
      // Reload campaigns to show updated status
      await loadCampaigns();
      
      alert(`Campaign reverted successfully!\n\n${result.revertedCount} variants restored.`);
    } catch (error: any) {
      console.error("Error reverting campaign:", error);
      alert("Failed to revert campaign: " + error.message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(campaignId: string, campaignName: string) {
    if (!confirm(`Delete campaign "${campaignName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await saleClient.deleteCampaign(campaignId);
      alert("Campaign deleted successfully!");
      await loadCampaigns();
    } catch (error: any) {
      console.error("Error deleting campaign:", error);
      alert("Failed to delete campaign: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "-";
    return new Date(date).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDiscount(type: string, value: number) {
    if (type === "PERCENTAGE") {
      return `${value}%`;
    }
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  }

  function getTargetLabel(type: string) {
    switch (type) {
      case "PRODUCT":
        return "Specific Products";
      case "COLLECTION":
        return "Collection";
      case "PRODUCT_TYPE":
        return "Product Type";
      case "ALL":
        return "All Products";
      default:
        return type;
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header */}
      <div className="border-b border-gray-200 p-6 dark:border-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Sale Campaigns
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {total} campaigns
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => loadCampaigns()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>

            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Campaign
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mt-4 flex gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by campaign name..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {statusFilter === "all" ? "All Status" : statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()}
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
                <div className="absolute left-0 z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <div className="py-1">
                    {["all", "scheduled", "active", "completed", "failed"].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status);
                          setPage(1);
                          setFilterDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          statusFilter === status ? "text-brand-700 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {statusFilter === status && (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span className={statusFilter !== status ? "ml-7" : ""}>
                          {status === "all" ? "All Status" : status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
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
              <TableCell isHeader>Campaign</TableCell>
              <TableCell isHeader>Discount</TableCell>
              <TableCell isHeader>Target</TableCell>
              <TableCell isHeader>Schedule</TableCell>
              <TableCell isHeader>Status</TableCell>
              <TableCell isHeader>Affected</TableCell>
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
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-gray-500">
                  No campaigns found
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <div>
                      <a
                        href={`/sale-campaigns/${campaign.id}`}
                        className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        {campaign.name}
                      </a>
                      {campaign.description && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                          {campaign.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {formatDiscount(campaign.discountType, campaign.discountValue)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-700 dark:text-gray-300">
                      {getTargetLabel(campaign.targetType)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {campaign.scheduleType === "IMMEDIATE" ? (
                        <span className="text-gray-500 dark:text-gray-400">Immediate</span>
                      ) : (
                        <div>
                          <p className="text-gray-700 dark:text-gray-300">
                            {formatDate(campaign.startDate)}
                          </p>
                          {campaign.endDate && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              → {formatDate(campaign.endDate)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={campaign.status as CampaignStatus} />
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-700 dark:text-gray-300">
                      {campaign.affectedCount || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {campaign.status === "SCHEDULED" ? (
                        <button
                          onClick={() => handleApply(campaign.id, campaign.name)}
                          disabled={actionLoadingId === campaign.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-success-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-600 disabled:opacity-50"
                        >
                          {actionLoadingId === campaign.id ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          Apply
                        </button>
                      ) : campaign.status === "ACTIVE" ? (
                        <button
                          onClick={() => handleRevert(campaign.id, campaign.name)}
                          disabled={actionLoadingId === campaign.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-warning-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-warning-600 disabled:opacity-50"
                        >
                          {actionLoadingId === campaign.id ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          )}
                          Revert
                        </button>
                      ) : null}

                      {campaign.status !== "ACTIVE" && 
                       campaign.status !== "APPLYING" && 
                       campaign.status !== "REVERTING" && (
                        <button
                          onClick={() => handleDelete(campaign.id, campaign.name)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-danger-300 bg-white px-3 py-1.5 text-xs font-medium text-danger-700 hover:bg-danger-50 dark:border-danger-700 dark:bg-gray-800 dark:text-danger-400 dark:hover:bg-danger-900/20"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {campaigns.length > 0 && totalPages > 1 && (
        <div className="flex flex-col gap-4 border-t border-gray-200 px-6 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing <span className="font-medium text-gray-700 dark:text-gray-300">{(page - 1) * limit + 1}</span> to{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {Math.min(page * limit, total)}
            </span>{" "}
            of <span className="font-medium text-gray-700 dark:text-gray-300">{total}</span> campaigns
          </div>
          
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => {
          setCreateModalOpen(false);
          loadCampaigns();
        }}
      />
    </div>
  );
}
