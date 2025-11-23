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
      <CustomerSyncTable />
    </>
  );
}
