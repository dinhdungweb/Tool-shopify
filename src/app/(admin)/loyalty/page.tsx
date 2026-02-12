import type { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import LoyaltyPage from "@/components/loyalty/LoyaltyPage";

export const metadata: Metadata = {
    title: "Loyalty & Rewards | Hạng Thành Viên",
    description: "Quản lý hạng thành viên và điểm thưởng",
};

export default function LoyaltyAdminPage() {
    return (
        <>
            <PageBreadcrumb pageTitle="Loyalty & Rewards" />
            <LoyaltyPage />
        </>
    );
}
