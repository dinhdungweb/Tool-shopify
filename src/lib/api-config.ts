/**
 * API Configuration Helper
 * This module provides a centralized way to get API credentials
 * It first checks the database (encrypted), then falls back to environment variables
 */

import { getSetting } from "./settings";

let cachedConfig: {
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
} | null = null;

let cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get API configuration (with caching)
 */
export async function getApiConfig() {
  const now = Date.now();
  
  // Return cached config if still valid
  if (cachedConfig && (now - cacheTime) < CACHE_TTL) {
    return cachedConfig;
  }

  // Fetch from database (or fallback to env)
  cachedConfig = {
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

  cacheTime = now;
  return cachedConfig;
}

/**
 * Clear the cache (call this after updating settings)
 */
export function clearApiConfigCache() {
  cachedConfig = null;
  cacheTime = 0;
}

/**
 * Get Shopify config
 */
export async function getShopifyConfig() {
  const config = await getApiConfig();
  return {
    ...config.shopify,
    apiVersion: "2024-01", // Default API version
  };
}

/**
 * Get Nhanh config
 */
export async function getNhanhConfig() {
  const config = await getApiConfig();
  return config.nhanh;
}
