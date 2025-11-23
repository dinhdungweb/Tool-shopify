"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saleClient } from "@/lib/api-client";
import { CampaignStatus } from "@/types/sale";
import CampaignStatusBadge from "./CampaignStatusBadge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";

interface CampaignDetailViewProps {
  params: Promise<{ id: string }>;
}

export default function CampaignDetailView({ params }: CampaignDetailViewProps) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [campaignId, setCampaignId] = useState<string>("");

  useEffect(() => {
    params.then((p) => {
      setCampaignId(p.id);
      loadCampaign(p.id);
    });
  }, [params]);

  async function loadCampaign(id: string) {
    try {
      setLoading(true);
      const data = await saleClient.getCampaignById(id);
      setCampaign(data);
    } catch (error: any) {
      console.error("Error loading campaign:", error);
      alert("Failed to load campaign: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!campaign) return;
    
    if (!confirm(`Apply campaign "${campaign.name}"?\n\nThis will update prices on Shopify.`)) {
      return;
    }

    try {
      setActionLoading(true);
      const result = await saleClient.applyCampaign(campaignId);
      
      if (result.failedCount > 0) {
        alert(
          `Campaign applied with some errors:\n\n` +
          `✓ ${result.affectedCount} variants updated successfully\n` +
          `✗ ${result.failedCount} variants failed\n\n` +
          `Check the Failed Variants section below for details.`
        );
      } else {
        alert(`Campaign applied successfully!\n\n${result.affectedCount} variants updated.`);
      }
      
      await loadCampaign(campaignId);
    } catch (error: any) {
      console.error("Error applying campaign:", error);
      alert("Failed to apply campaign: " + error.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevert() {
    if (!campaign) return;
    
    if (!confirm(`Revert campaign "${campaign.name}"?\n\nThis will restore original prices.`)) {
      return;
    }

    try {
      setActionLoading(true);
      const result = await saleClient.revertCampaign(campaignId);
      alert(`Campaign reverted successfully!\n\n${result.revertedCount} variants restored.`);
      await loadCampaign(campaignId);
    } catch (error: any) {
      console.error("Error reverting campaign:", error);
      alert("Failed to revert campaign: " + error.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!campaign) return;
    
    if (!confirm(`Delete campaign "${campaign.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading(true);
      await saleClient.deleteCampaign(campaignId);
      alert("Campaign deleted successfully!");
      router.push("/sale-campaigns");
    } catch (error: any) {
      console.error("Error deleting campaign:", error);
      alert("Failed to delete campaign: " + error.message);
    } finally {
      setActionLoading(false);
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

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  }

  function formatDiscount(type: string, value: number) {
    if (type === "PERCENTAGE") {
      return `${value}%`;
    }
    return formatCurrency(value);
  }

  function getTargetLabel(type: string, ids: string[], productType?: string, collectionTitle?: string) {
    switch (type) {
      case "PRODUCT":
        return `${ids.length} Specific Products`;
      case "COLLECTION":
        return collectionTitle || "Collection";
      case "PRODUCT_TYPE":
        return productType || "Product Type";
      case "ALL":
        return "All Products";
      default:
        return type;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Campaign not found</p>
        <button
          onClick={() => router.push("/sale-campaigns")}
          className="mt-4 text-brand-500 hover:text-brand-600"
        >
          Back to campaigns
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push("/sale-campaigns")}
            className="mb-2 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to campaigns
          </button>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {campaign.name}
          </h2>
          {campaign.description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {campaign.description}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          {campaign.status === "DRAFT" || campaign.status === "SCHEDULED" ? (
            <button
              onClick={handleApply}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-success-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-success-600 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Apply Campaign
            </button>
          ) : campaign.status === "ACTIVE" ? (
            <button
              onClick={handleRevert}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-warning-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-warning-600 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Revert Campaign
            </button>
          ) : null}

          {campaign.status !== "ACTIVE" && 
           campaign.status !== "APPLYING" && 
           campaign.status !== "REVERTING" && (
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-danger-300 bg-white px-4 py-2.5 text-sm font-medium text-danger-700 hover:bg-danger-50 disabled:opacity-50 dark:border-danger-700 dark:bg-gray-800 dark:text-danger-400 dark:hover:bg-danger-900/20"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Campaign Info Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
          <div className="mt-2">
            <CampaignStatusBadge status={campaign.status as CampaignStatus} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Discount</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white">
            {formatDiscount(campaign.discountType, campaign.discountValue)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Target</p>
          <p className="mt-2 text-lg font-medium text-gray-800 dark:text-white">
            {getTargetLabel(campaign.targetType, campaign.targetIds, campaign.productType, campaign.collectionTitle)}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Affected Variants</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white">
            {campaign.affectedCount || 0}
          </p>
        </div>
      </div>

      {/* Schedule Info */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
          Schedule
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
            <p className="mt-1 text-gray-800 dark:text-white">
              {campaign.scheduleType === "IMMEDIATE" ? "Immediate" : "Scheduled"}
            </p>
          </div>
          {campaign.startDate && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Start Date</p>
              <p className="mt-1 text-gray-800 dark:text-white">
                {formatDate(campaign.startDate)}
              </p>
            </div>
          )}
          {campaign.endDate && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">End Date</p>
              <p className="mt-1 text-gray-800 dark:text-white">
                {formatDate(campaign.endDate)}
              </p>
            </div>
          )}
        </div>
        {campaign.appliedAt && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Applied At</p>
            <p className="mt-1 text-gray-800 dark:text-white">
              {formatDate(campaign.appliedAt)}
            </p>
          </div>
        )}
      </div>

      {/* Failed Variants Section */}
      {campaign.priceChanges && campaign.priceChanges.filter((c: any) => c.error).length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-200 p-6 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Failed Variants ({campaign.priceChanges.filter((c: any) => c.error).length})
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              These variants could not be updated on Shopify
            </p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-gray-100 dark:border-gray-800 border-y bg-gray-50 dark:bg-gray-900">
                <TableRow>
                  <TableCell isHeader>Product</TableCell>
                  <TableCell isHeader>SKU</TableCell>
                  <TableCell isHeader>Error Message</TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {campaign.priceChanges.filter((c: any) => c.error).map((change: any) => (
                  <TableRow key={change.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white/90">
                          {change.productTitle}
                        </p>
                        {change.variantTitle && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {change.variantTitle}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-700 dark:text-gray-300">
                        {change.sku || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-danger-700 dark:text-danger-400">
                        {change.error}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Price Changes Table */}
      {campaign.priceChanges && campaign.priceChanges.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="border-b border-gray-200 p-6 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Affected Products ({campaign.priceChanges.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-gray-100 dark:border-gray-800 border-y bg-gray-50 dark:bg-gray-900">
                <TableRow>
                  <TableCell isHeader>Product</TableCell>
                  <TableCell isHeader>SKU</TableCell>
                  <TableCell isHeader>Original Price</TableCell>
                  <TableCell isHeader>Sale Price</TableCell>
                  <TableCell isHeader>Savings</TableCell>
                  <TableCell isHeader>Status</TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {campaign.priceChanges.slice(0, 50).map((change: any) => {
                  const savings = Number(change.originalPrice) - Number(change.salePrice);
                  const savingsPercent = (savings / Number(change.originalPrice)) * 100;

                  return (
                    <TableRow key={change.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white/90">
                            {change.productTitle}
                          </p>
                          {change.variantTitle && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {change.variantTitle}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-700 dark:text-gray-300">
                          {change.sku || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-700 dark:text-gray-300">
                          {formatCurrency(Number(change.originalPrice))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-success-600 dark:text-success-400">
                          {formatCurrency(Number(change.salePrice))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-700 dark:text-gray-300">
                          -{savingsPercent.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {change.error ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-xs text-danger-600 dark:text-danger-400">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Failed
                            </span>
                          </div>
                        ) : change.applied ? (
                          change.reverted ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400">Reverted</span>
                          ) : (
                            <span className="text-xs text-success-600 dark:text-success-400">Applied</span>
                          )
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">Pending</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {campaign.priceChanges.length > 50 && (
            <div className="border-t border-gray-200 p-4 text-center dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing first 50 of {campaign.priceChanges.length} price changes
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
