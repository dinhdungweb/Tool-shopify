/**
 * Client-side API helper functions
 * Use these in React components to call API endpoints
 */

import { NhanhCustomer } from "@/types/nhanh";
import { ShopifyCustomer } from "@/types/shopify";
import { CustomerMappingData, SyncResult, BulkSyncResult } from "@/types/mapping";

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || "";

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "API request failed");
  }

  return data.data;
}

// Nhanh.vn API calls
export const nhanhClient = {
  async getCustomers(params?: { 
    page?: number; 
    limit?: number; 
    keyword?: string;
    next?: any;
    fetchAll?: boolean;
  }) {
    // Filter out undefined values and handle next cursor properly
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Handle next cursor - stringify if it's an object
          if (key === 'next' && typeof value === 'object') {
            cleanParams[key] = JSON.stringify(value);
          } else if (key !== 'next') {
            cleanParams[key] = String(value);
          } else {
            cleanParams[key] = value as string;
          }
        }
      });
    }
    
    const query = new URLSearchParams(cleanParams).toString();
    return apiCall<{ 
      customers: NhanhCustomer[]; 
      total: number; 
      page: number; 
      limit: number;
      next?: any;
      hasMore: boolean;
    }>(
      `/api/nhanh/customers?${query}`
    );
  },

  async getAllCustomers() {
    return apiCall<{ 
      customers: NhanhCustomer[]; 
      total: number;
    }>(
      `/api/nhanh/customers?fetchAll=true`
    );
  },

  async getCustomerById(id: string) {
    return apiCall<NhanhCustomer>(`/api/nhanh/customer/${id}`);
  },

  async searchCustomers(query: string) {
    return apiCall<NhanhCustomer[]>("/api/nhanh/search", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  },

  // Pull all customers from Nhanh.vn and save to database
  async pullCustomers() {
    return apiCall<{
      total: number;
      created: number;
      updated: number;
    }>(
      "/api/nhanh/pull-customers",
      { method: "POST" }
    );
  },

  // Get customers from local database
  async getLocalCustomers(params?: {
    page?: number;
    limit?: number;
    keyword?: string;
    mappingStatus?: "mapped" | "unmapped";
    syncStatus?: "all" | "unmapped" | "pending" | "synced" | "failed";
  }) {
    // Filter out undefined values
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanParams[key] = String(value);
        }
      });
    }
    
    const query = new URLSearchParams(cleanParams).toString();
    return apiCall<{
      customers: NhanhCustomer[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(
      `/api/nhanh/local-customers?${query}`
    );
  },
};

// Shopify API calls
export const shopifyClient = {
  async searchCustomers(params: { query?: string; email?: string; phone?: string }) {
    return apiCall<ShopifyCustomer[]>("/api/shopify/search", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async getCustomerById(id: string) {
    return apiCall<ShopifyCustomer>(`/api/shopify/customer/${id}`);
  },

  async updateMetafield(params: {
    customerId: string;
    namespace: string;
    key: string;
    value: string;
    type: string;
  }) {
    return apiCall<{ success: boolean; message: string }>(
      "/api/shopify/update-metafield",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
  },

  async pullCustomers() {
    return apiCall<{
      success: boolean;
      message: string;
    }>("/api/shopify/pull-customers", {
      method: "POST",
    });
  },
};

// Mapping & Sync API calls
export const syncClient = {
  async getMappings(params?: { page?: number; limit?: number; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return apiCall<{
      mappings: CustomerMappingData[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/api/sync/mapping?${query}`);
  },

  async getMappingById(id: string) {
    return apiCall<CustomerMappingData>(`/api/sync/mapping/${id}`);
  },

  async createMapping(data: {
    nhanhCustomerId: string;
    nhanhCustomerName: string;
    nhanhCustomerPhone?: string;
    nhanhCustomerEmail?: string;
    nhanhTotalSpent?: number;
    shopifyCustomerId?: string;
    shopifyCustomerEmail?: string;
    shopifyCustomerName?: string;
  }) {
    return apiCall<CustomerMappingData>("/api/sync/mapping", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateMapping(
    id: string,
    data: {
      shopifyCustomerId?: string;
      shopifyCustomerEmail?: string;
      shopifyCustomerName?: string;
      syncStatus?: string;
    }
  ) {
    return apiCall<CustomerMappingData>(`/api/sync/mapping/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteMapping(id: string) {
    return apiCall<{ message: string }>(`/api/sync/mapping?id=${id}`, {
      method: "DELETE",
    });
  },

  async autoMatchSQL(dryRun: boolean = false) {
    return apiCall<{
      total: number;
      matched: number;
      failed: number;
      skipped: number;
      details: any[];
      dryRun: boolean;
      message: string;
      duration: string;
      method: string;
    }>("/api/sync/auto-match-sql", {
      method: "POST",
      body: JSON.stringify({ dryRun }),
    });
  },

  async autoMatchProducts(dryRun: boolean = false) {
    return apiCall<{
      total: number;
      matched: number;
      failed: number;
      skipped: number;
      details: any[];
      dryRun: boolean;
      message: string;
      duration: string;
      method: string;
    }>("/api/sync/auto-match-products", {
      method: "POST",
      body: JSON.stringify({ dryRun }),
    });
  },

  async syncCustomer(mappingId: string) {
    return apiCall<SyncResult>("/api/sync/sync-customer", {
      method: "POST",
      body: JSON.stringify({ mappingId }),
    });
  },

  async bulkSync(mappingIds: string[]) {
    return apiCall<BulkSyncResult>("/api/sync/bulk-sync", {
      method: "POST",
      body: JSON.stringify({ mappingIds }),
    });
  },
};

// Sale Campaign API calls
export const saleClient = {
  async getCampaigns(params?: {
    page?: number;
    limit?: number;
    status?: string;
    targetType?: string;
  }) {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanParams[key] = String(value);
        }
      });
    }

    const query = new URLSearchParams(cleanParams).toString();
    return apiCall<{
      campaigns: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/api/sale/campaigns?${query}`);
  },

  async getCampaignById(id: string) {
    return apiCall<any>(`/api/sale/campaigns/${id}`);
  },

  async createCampaign(data: {
    name: string;
    description?: string;
    discountType: string;
    discountValue: number;
    targetType: string;
    targetIds: string[];
    productType?: string;
    collectionTitle?: string;
    scheduleType: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    return apiCall<any>("/api/sale/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateCampaign(id: string, data: any) {
    return apiCall<any>(`/api/sale/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteCampaign(id: string) {
    return apiCall<{ message: string }>(`/api/sale/campaigns/${id}`, {
      method: "DELETE",
    });
  },

  async previewCampaign(id: string) {
    return apiCall<{
      totalProducts: number;
      totalVariants: number;
      estimatedSavings: number;
      products: any[];
    }>(`/api/sale/campaigns/${id}/preview`);
  },

  async applyCampaign(id: string) {
    return apiCall<{
      affectedCount: number;
      failedCount: number;
      errors: string[];
    }>(`/api/sale/campaigns/${id}/apply`, {
      method: "POST",
    });
  },

  async revertCampaign(id: string) {
    return apiCall<{
      revertedCount: number;
      failedCount: number;
      errors: string[];
    }>(`/api/sale/campaigns/${id}/revert`, {
      method: "POST",
    });
  },

  async checkConflicts(data: {
    targetType: string;
    targetIds: string[];
    productType?: string;
    excludeCampaignId?: string;
  }) {
    return apiCall<{
      hasConflict: boolean;
      conflictingCampaigns: any[];
    }>("/api/sale/campaigns/check-conflicts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Shopify data
  async getProducts(params?: {
    first?: number;
    after?: string;
    query?: string;
  }) {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanParams[key] = String(value);
        }
      });
    }

    const query = new URLSearchParams(cleanParams).toString();
    return apiCall<{
      products: any[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    }>(`/api/sale/shopify/products?${query}`);
  },

  async getCollections() {
    return apiCall<any[]>("/api/sale/shopify/collections");
  },

  async getProductTypes() {
    return apiCall<string[]>("/api/sale/shopify/product-types");
  },

  // Scheduler
  async getSchedulerStatus() {
    return apiCall<{
      scheduler: { isInitialized: boolean; isRunning: boolean };
      upcomingCampaigns: any[];
      activeCampaigns: any[];
    }>("/api/sale/scheduler/status");
  },

  async triggerScheduler() {
    return apiCall<{ message: string }>("/api/sale/scheduler/trigger", {
      method: "POST",
    });
  },

  async restartScheduler() {
    return apiCall<{
      scheduler: { isInitialized: boolean; isRunning: boolean };
    }>("/api/sale/scheduler/restart", {
      method: "POST",
    });
  },
};

// Product Sync API calls
export const productSyncClient = {
  // Nhanh Products
  async getNhanhProducts(params?: {
    page?: number;
    limit?: number;
    keyword?: string;
  }) {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanParams[key] = String(value);
        }
      });
    }

    const query = new URLSearchParams(cleanParams).toString();
    return apiCall<any>(`/api/nhanh/products?${query}`);
  },

  async searchNhanhProducts(keyword: string) {
    return apiCall<any[]>("/api/nhanh/search-products", {
      method: "POST",
      body: JSON.stringify({ keyword }),
    });
  },

  async searchLocalNhanhProducts(keyword: string) {
    const cleanParams: Record<string, string> = { keyword };
    const query = new URLSearchParams(cleanParams).toString();
    const result = await apiCall<{
      products: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/nhanh/local-products?${query}`);
    return result.products;
  },

  async pullNhanhProducts() {
    return apiCall<{
      success: boolean;
      message: string;
    }>("/api/nhanh/pull-products", {
      method: "POST",
    });
  },

  async getLocalNhanhProducts(params?: {
    page?: number;
    limit?: number;
    keyword?: string;
    mappingStatus?: "mapped" | "unmapped";
    syncStatus?: string;
  }) {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanParams[key] = String(value);
        }
      });
    }

    const query = new URLSearchParams(cleanParams).toString();
    return apiCall<{
      products: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/nhanh/local-products?${query}`);
  },

  // Shopify Products
  async getLocalShopifyProducts(params?: {
    page?: number;
    limit?: number;
    keyword?: string;
    mappingStatus?: "mapped" | "unmapped";
    syncStatus?: string;
  }) {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanParams[key] = String(value);
        }
      });
    }

    const query = new URLSearchParams(cleanParams).toString();
    return apiCall<{
      products: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/shopify/local-products?${query}`);
  },

  async searchShopifyProducts(params: {
    keyword?: string;
    sku?: string;
    barcode?: string;
  }) {
    return apiCall<any[]>("/api/shopify/search-products", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async pullShopifyProducts() {
    return apiCall<{
      message: string;
    }>(`/api/shopify/pull-products-sync?t=${Date.now()}`, {
      method: "POST",
    });
  },

  // Product Mapping
  async getProductMappings(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          cleanParams[key] = String(value);
        }
      });
    }

    const query = new URLSearchParams(cleanParams).toString();
    return apiCall<{
      mappings: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/api/sync/product-mapping?${query}`);
  },

  async createProductMapping(data: {
    nhanhProductId: string;
    nhanhProductName: string;
    nhanhSku?: string;
    nhanhBarcode?: string;
    nhanhPrice?: number;
    shopifyProductId?: string;
    shopifyVariantId?: string;
    shopifyProductTitle?: string;
    shopifySku?: string;
    shopifyBarcode?: string;
  }) {
    return apiCall<any>("/api/sync/product-mapping", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateProductMapping(id: string, data: any) {
    return apiCall<any>("/api/sync/product-mapping", {
      method: "PATCH",
      body: JSON.stringify({ id, ...data }),
    });
  },

  async deleteProductMapping(id: string) {
    return apiCall<{ message: string }>(`/api/sync/product-mapping?id=${id}`, {
      method: "DELETE",
    });
  },

  // Product Sync
  async syncProduct(mappingId: string) {
    return apiCall<any>("/api/sync/sync-product", {
      method: "POST",
      body: JSON.stringify({ mappingId }),
    });
  },
};
