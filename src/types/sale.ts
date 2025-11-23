// Sale Campaign Types

export enum CampaignStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  APPLYING = "APPLYING",
  ACTIVE = "ACTIVE",
  REVERTING = "REVERTING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
}

export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FIXED_AMOUNT = "FIXED_AMOUNT",
}

export enum TargetType {
  PRODUCT = "PRODUCT",
  COLLECTION = "COLLECTION",
  PRODUCT_TYPE = "PRODUCT_TYPE",
  ALL = "ALL",
}

export enum ScheduleType {
  IMMEDIATE = "IMMEDIATE",
  SCHEDULED = "SCHEDULED",
}

export interface SaleCampaign {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description?: string;
  status: CampaignStatus;
  discountType: DiscountType;
  discountValue: number;
  targetType: TargetType;
  targetIds: string[];
  productType?: string;
  scheduleType: ScheduleType;
  startDate?: Date;
  endDate?: Date;
  appliedAt?: Date;
  revertedAt?: Date;
  affectedCount: number;
  errorMessage?: string;
}

export interface PriceChange {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  campaignId: string;
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle?: string;
  sku?: string;
  originalPrice: number;
  salePrice: number;
  currentPrice: number;
  applied: boolean;
  appliedAt?: Date;
  reverted: boolean;
  revertedAt?: Date;
  error?: string;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  targetType: TargetType;
  targetIds: string[];
  productType?: string;
  collectionTitle?: string;
  scheduleType: ScheduleType;
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  targetType?: TargetType;
  targetIds?: string[];
  productType?: string;
  scheduleType?: ScheduleType;
  startDate?: Date;
  endDate?: Date;
}

export interface CampaignPreview {
  totalProducts: number;
  totalVariants: number;
  estimatedRevenue: number;
  products: PreviewProduct[];
}

export interface PreviewProduct {
  id: string;
  title: string;
  variants: PreviewVariant[];
}

export interface PreviewVariant {
  id: string;
  title: string;
  sku?: string;
  originalPrice: number;
  salePrice: number;
  savings: number;
  savingsPercentage: number;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  productType: string;
  variants: ShopifyVariant[];
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku?: string;
  price: string;
  compareAtPrice?: string;
}

export interface ShopifyCollection {
  id: string;
  title: string;
  productsCount: number;
}
