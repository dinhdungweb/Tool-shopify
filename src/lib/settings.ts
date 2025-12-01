import { prisma } from "./prisma";
import { encrypt, decrypt } from "./encryption";

export type SettingKey =
  | "SHOPIFY_STORE_URL"
  | "SHOPIFY_ACCESS_TOKEN"
  | "NHANH_API_URL"
  | "NHANH_APP_ID"
  | "NHANH_BUSINESS_ID"
  | "NHANH_ACCESS_TOKEN";

/**
 * Get a setting value (decrypted)
 */
export async function getSetting(key: SettingKey): Promise<string | null> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      // Fallback to environment variable
      return process.env[key] || null;
    }

    // Decrypt the value
    return decrypt(setting.value);
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    // Fallback to environment variable
    return process.env[key] || null;
  }
}

/**
 * Set a setting value (encrypted)
 */
export async function setSetting(key: SettingKey, value: string): Promise<void> {
  try {
    // Encrypt the value
    const encryptedValue = encrypt(value);

    // Upsert to database
    await prisma.setting.upsert({
      where: { key },
      update: {
        value: encryptedValue,
        updatedAt: new Date(),
      },
      create: {
        key,
        value: encryptedValue,
      },
    });
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    throw new Error(`Failed to save setting: ${key}`);
  }
}

/**
 * Get multiple settings at once
 */
export async function getSettings(
  keys: SettingKey[]
): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};

  await Promise.all(
    keys.map(async (key) => {
      result[key] = await getSetting(key);
    })
  );

  return result;
}

/**
 * Get all API credentials
 */
export async function getApiCredentials() {
  return {
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

/**
 * Update all API credentials
 */
export async function updateApiCredentials(credentials: {
  shopify?: {
    storeUrl?: string;
    accessToken?: string;
  };
  nhanh?: {
    apiUrl?: string;
    appId?: string;
    businessId?: string;
    accessToken?: string;
  };
}) {
  const updates: Promise<void>[] = [];

  if (credentials.shopify?.storeUrl) {
    updates.push(setSetting("SHOPIFY_STORE_URL", credentials.shopify.storeUrl));
  }
  if (credentials.shopify?.accessToken) {
    updates.push(setSetting("SHOPIFY_ACCESS_TOKEN", credentials.shopify.accessToken));
  }
  if (credentials.nhanh?.apiUrl) {
    updates.push(setSetting("NHANH_API_URL", credentials.nhanh.apiUrl));
  }
  if (credentials.nhanh?.appId) {
    updates.push(setSetting("NHANH_APP_ID", credentials.nhanh.appId));
  }
  if (credentials.nhanh?.businessId) {
    updates.push(setSetting("NHANH_BUSINESS_ID", credentials.nhanh.businessId));
  }
  if (credentials.nhanh?.accessToken) {
    updates.push(setSetting("NHANH_ACCESS_TOKEN", credentials.nhanh.accessToken));
  }

  await Promise.all(updates);
}

/**
 * Delete a setting
 */
export async function deleteSetting(key: SettingKey): Promise<void> {
  try {
    await prisma.setting.delete({
      where: { key },
    });
  } catch (error) {
    // Ignore if not found
    console.log(`Setting ${key} not found, skipping delete`);
  }
}

/**
 * Check if settings exist in database
 */
export async function hasSettingsInDatabase(): Promise<boolean> {
  const count = await prisma.setting.count();
  return count > 0;
}
