// Customer Mapping Types

import { SyncStatus, SyncAction } from "@prisma/client";

export interface CustomerMappingData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Nhanh.vn info
  nhanhCustomerId: string;
  nhanhCustomerName: string;
  nhanhCustomerPhone: string | null;
  nhanhCustomerEmail: string | null;
  nhanhTotalSpent: number;
  
  // Shopify info
  shopifyCustomerId: string | null;
  shopifyCustomerEmail: string | null;
  shopifyCustomerName: string | null;
  
  // Sync status
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  syncError: string | null;
  syncAttempts: number;
}

export interface CreateMappingInput {
  nhanhCustomerId: string;
  nhanhCustomerName: string;
  nhanhCustomerPhone?: string;
  nhanhCustomerEmail?: string;
  nhanhTotalSpent: number;
  shopifyCustomerId?: string;
  shopifyCustomerEmail?: string;
  shopifyCustomerName?: string;
}

export interface UpdateMappingInput {
  shopifyCustomerId?: string;
  shopifyCustomerEmail?: string;
  shopifyCustomerName?: string;
  syncStatus?: SyncStatus;
  lastSyncedAt?: Date;
  syncError?: string;
  syncAttempts?: number;
}

export interface SyncResult {
  success: boolean;
  mappingId: string;
  message: string;
  error?: string;
  syncedAt?: Date;
}

export interface BulkSyncResult {
  total: number;
  successful: number;
  failed: number;
  results: SyncResult[];
}

export interface SyncLogData {
  id: string;
  createdAt: Date;
  mappingId: string;
  action: SyncAction;
  status: SyncStatus;
  message: string | null;
  errorDetail: string | null;
  metadata: any;
}

export { SyncStatus, SyncAction };
