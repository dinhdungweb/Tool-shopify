// Customer Tier Constants
// Hạng thành viên dựa trên tổng chi tiêu (totalSpent) từ Nhanh.vn

export enum CustomerTier {
    MEMBER = "MEMBER",
    SILVER = "SILVER",
    GOLD = "GOLD",
    PLATINUM = "PLATINUM",
    DIAMOND = "DIAMOND",
    BLACK_DIAMOND = "BLACK_DIAMOND",
}

// Ngưỡng chi tiêu cho từng hạng (VND)
export const TIER_THRESHOLDS: { tier: CustomerTier; min: number; label: string; color: string }[] = [
    { tier: CustomerTier.BLACK_DIAMOND, min: 100_000_000, label: "Black Diamond", color: "#1a1a2e" },
    { tier: CustomerTier.DIAMOND, min: 20_000_000, label: "Diamond", color: "#b9f2ff" },
    { tier: CustomerTier.PLATINUM, min: 10_000_000, label: "Platinum", color: "#e5e4e2" },
    { tier: CustomerTier.GOLD, min: 6_000_000, label: "Gold", color: "#ffd700" },
    { tier: CustomerTier.SILVER, min: 3_000_000, label: "Silver", color: "#c0c0c0" },
    { tier: CustomerTier.MEMBER, min: 0, label: "Member", color: "#8b8b8b" },
];

/**
 * Tính hạng thành viên dựa trên tổng chi tiêu
 * - Member: 0 <= totalSpent < 3,000,000
 * - Silver: 3,000,000 <= totalSpent < 6,000,000
 * - Gold: 6,000,000 <= totalSpent < 10,000,000
 * - Platinum: 10,000,000 <= totalSpent < 20,000,000
 * - Diamond: 20,000,000 <= totalSpent < 100,000,000
 * - Black Diamond: >= 100,000,000
 */
export function calculateTier(totalSpent: number): CustomerTier {
    for (const { tier, min } of TIER_THRESHOLDS) {
        if (totalSpent >= min) {
            return tier;
        }
    }
    return CustomerTier.MEMBER;
}

/**
 * Lấy thông tin tier
 */
export function getTierInfo(tier: CustomerTier) {
    return TIER_THRESHOLDS.find((t) => t.tier === tier) || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
}

/**
 * Lấy label hiển thị cho tier
 */
export function getTierLabel(tier: string): string {
    const info = TIER_THRESHOLDS.find((t) => t.tier === tier);
    return info?.label || tier;
}

/**
 * Format tiền VND
 */
export function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}
