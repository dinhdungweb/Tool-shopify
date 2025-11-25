import type { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ProductSyncTable from "@/components/products-sync/ProductSyncTable";

export const metadata: Metadata = {
  title: "Product Sync | Nhanh.vn to Shopify",
  description: "Sync product inventory from Nhanh.vn to Shopify",
};

export default function ProductSyncPage() {
  return (
    <>
      <PageBreadcrumb pageTitle="Product Sync" />
      <ProductSyncTable />
    </>
  );
}
