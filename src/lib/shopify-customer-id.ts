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

/**
 * Return every mapping that points to the same Shopify customer, including
 * legacy mappings that still store the local ShopifyCustomer id or a numeric id.
 */
export async function findShopifyCustomerMappingConflicts(
  storeId: string,
  customerId: string,
  excludeMappingId?: string
) {
  const shopifyGid = await resolveShopifyCustomerGid(storeId, customerId);
  if (!shopifyGid) return [];

  const shopifyCustomer = await prisma.shopifyCustomer.findFirst({
    where: { storeId, shopifyId: shopifyGid },
    select: { id: true, shopifyId: true },
  });

  const numericId = shopifyGid.slice(SHOPIFY_CUSTOMER_GID_PREFIX.length);
  const aliases = Array.from(new Set([
    shopifyGid,
    numericId,
    shopifyCustomer?.id,
    shopifyCustomer?.shopifyId,
  ].filter((value): value is string => Boolean(value))));

  return prisma.customerMapping.findMany({
    where: {
      storeId,
      shopifyCustomerId: { in: aliases },
      ...(excludeMappingId ? { id: { not: excludeMappingId } } : {}),
    },
    select: {
      id: true,
      nhanhCustomerName: true,
      nhanhCustomer: { select: { nhanhId: true } },
    },
  });
}

export async function assertUniqueShopifyCustomerMapping(
  storeId: string,
  customerId: string,
  currentMappingId: string
) {
  const conflicts = await findShopifyCustomerMappingConflicts(
    storeId,
    customerId,
    currentMappingId
  );

  if (conflicts.length === 0) return;

  const owners = conflicts
    .map((mapping) => `"${mapping.nhanhCustomerName}" (Nhanh ID: ${mapping.nhanhCustomer.nhanhId})`)
    .join(", ");

  throw new Error(
    `Không thể đồng bộ vì Shopify customer ${customerId} đang được liên kết với nhiều Nhanh customer. Mapping khác: ${owners}. Hãy xóa mapping sai trước khi đồng bộ lại.`
  );
}
