import { Metadata } from "next";
import CampaignDetailView from "@/components/sale-campaigns/CampaignDetailView";

export const metadata: Metadata = {
  title: "Campaign Details | Shopify Tools",
  description: "View campaign details and affected products",
};

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <CampaignDetailView params={params} />;
}
