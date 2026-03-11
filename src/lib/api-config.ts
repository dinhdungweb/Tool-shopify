/**
 * API Configuration Helper (Multi-Tenant)
 * Provides API credentials per-store from StoreConnection table.
 * Falls back to legacy Settings table for backward compatibility.
 */

import { prisma } from "./prisma";
import { getSetting } from "./settings";

// Per-store config cache
const storeConfigCache = new Map<string, {
  config: StoreApiConfig;
  cacheTime: number;
}>();

const CACHE_TTL = 60000; // 1 minute cache

interface StoreApiConfig {
  shopify: {
    storeUrl: string | null;
    accessToken: string | null;
  };
  nhanh: {
    apiUrl: string | null;
    appId: string | null;
    businessId: string | null;
    accessToken: string | null;
  };
}

/**
 * Get API config for a specific store
 */
export async function getApiConfig(storeId?: string): Promise<StoreApiConfig> {
  const effectiveStoreId = storeId || "default_store";
  const now = Date.now();

  // Check cache
  const cached = storeConfigCache.get(effectiveStoreId);
  if (cached && (now - cached.cacheTime) < CACHE_TTL) {
    return cached.config;
  }

  // Try StoreConnection first
  const store = await prisma.storeConnection.findUnique({
    where: { id: effectiveStoreId },
  });

  let config: StoreApiConfig;

  if (store) {
    config = {
      shopify: {
        storeUrl: store.shopifyStoreUrl,
        accessToken: store.shopifyAccessToken,
      },
      nhanh: {
        apiUrl: store.nhanhApiUrl,
        appId: store.nhanhAppId,
        businessId: store.nhanhBusinessId,
        accessToken: store.nhanhAccessToken,
      },
    };
  } else {
    // Fallback: legacy Settings table
    config = {
      shopify: {
        storeUrl: await getSetting("SHOPIFY_STORE_URL"),
        accessToken: await getSetting("SHOPIFY_ACCESS_TOKEN"),
      },
      nhanh: {
        apiUrl: await getSetting("NHANH_API_URL"),
        appId: await getSetting("NHANH_APP_ID"),
        businessId: await getSetting("NHANH_BUSINESS_ID"),
        accessToken: await getSetting("NHANH_ACCESS_TOKEN"),
      },
    };
  }

  // Update cache
  storeConfigCache.set(effectiveStoreId, { config, cacheTime: now });
  return config;
}

/**
 * Clear cache for a specific store (or all stores)
 */
export function clearApiConfigCache(storeId?: string) {
  if (storeId) {
    storeConfigCache.delete(storeId);
  } else {
    storeConfigCache.clear();
  }
}

/**
 * Get Shopify config for a specific store
 */
export async function getShopifyConfig(storeId?: string) {
  const config = await getApiConfig(storeId);
  return {
    ...config.shopify,
    apiVersion: "2024-01",
  };
}

/**
 * Get Nhanh config for a specific store
 */
export async function getNhanhConfig(storeId?: string) {
  const config = await getApiConfig(storeId);
  return config.nhanh;
}
