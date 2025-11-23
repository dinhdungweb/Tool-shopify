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
      <SaleCampaignsTable />
    </>
  );
}
