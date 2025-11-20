import type { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CustomerSyncTable from "@/components/customers-sync/CustomerSyncTable";

export const metadata: Metadata = {
  title: "Customer Sync | Nhanh.vn to Shopify",
  description: "Sync customer data from Nhanh.vn to Shopify",
};

export default function CustomerSyncPage() {
  return (
    <>
      <PageBreadcrumb pageTitle="Customer Sync" />
      
      <div className="space-y-6">
        {/* Header Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Nhanh.vn to Shopify Customer Sync
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Map and sync customer total spent from Nhanh.vn to Shopify custom fields.
            Select customers to map them with Shopify customers, then sync their data.
          </p>
        </div>

        {/* Main Table */}
        <CustomerSyncTable />
      </div>
    </>
  );
}
