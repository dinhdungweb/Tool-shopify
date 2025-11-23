import type { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import SaleCampaignsTable from "@/components/sale-campaigns/SaleCampaignsTable";

export const metadata: Metadata = {
  title: "Sale Campaigns | Shopify Tools",
  description: "Manage sale campaigns and pricing",
};

export default function SaleCampaignsPage() {
  return (
    <>
      <PageBreadcrumb pageTitle="Sale Campaigns" />
      
      <div className="space-y-6">
        {/* Header Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Sale Campaigns
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Create and manage sale campaigns for your Shopify products
          </p>
        </div>

        {/* Main Table */}
        <SaleCampaignsTable />
      </div>
    </>
  );
}
