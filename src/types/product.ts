// Product types for Nhanh and Shopify sync

export interface NhanhProduct {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  comparePrice?: number;
  quantity: number;
  categoryId?: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  description?: string;
  images?: string[];
  lastPulledAt?: string;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  variantId?: string;
  sku?: string;
  barcode?: string;
  price: number;
  compareAtPrice?: number;
  inventoryQuantity: number;
  images?: string[];
  lastPulledAt?: string;
}

export interface ProductMappingData {
  id: string;
  createdAt: string;
  updatedAt: string;
  
  // Nhanh Product Info
  nhanhProductId: string;
  nhanhProductName: string;
  nhanhSku?: string;
  nhanhBarcode?: string;
  nhanhPrice: number;
  
  // Shopify Product Info
  shopifyProductId?: string;
  shopifyVariantId?: string;
  shopifyProductTitle?: string;
  shopifySku?: string;
  shopifyBarcode?: string;
  
  // Sync Status
  syncStatus: "UNMAPPED" | "PENDING" | "SYNCED" | "FAILED";
  lastSyncedAt?: string;
  syncError?: string;
  syncAttempts: number;
}

export interface ProductSyncResult {
  success: boolean;
  message: string;
  mapping?: ProductMappingData;
  error?: string;
}

export interface BulkProductSyncResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    mappingId: string;
    productName: string;
    error: string;
  }>;
}
