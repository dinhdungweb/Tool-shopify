import { prisma } from "@/lib/prisma";

const SHOPIFY_CUSTOMER_GID_PREFIX = "gid://shopify/Customer/";

export function normalizeShopifyCustomerGid(customerId: string): string | null {
  const value = customerId.trim();

  if (/^gid:\/\/shopify\/Customer\/\d+$/.test(value)) {
    return value;
  }

  if (/^\d+$/.test(value)) {
    return `${SHOPIFY_CUSTOMER_GID_PREFIX}${value}`;
  }

  return null;
}

/**
 * Resolve legacy mappings that contain the local ShopifyCustomer cuid instead
 * of Shopify's GraphQL customer GID.
 */
export async function resolveShopifyCustomerGid(
  storeId: string,
  customerId: string
): Promise<string | null> {
  const normalized = normalizeShopifyCustomerGid(customerId);
  if (normalized) return normalized;

  const customer = await prisma.shopifyCustomer.findFirst({
    where: {
      storeId,
      OR: [{ id: customerId }, { shopifyId: customerId }],
    },
    select: { shopifyId: true },
  });

  return customer ? normalizeShopifyCustomerGid(customer.shopifyId) : null;
}
