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
