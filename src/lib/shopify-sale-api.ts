// Shopify Sale API Helper
import { ShopifyCollection, ShopifyProduct, ShopifyVariant } from "@/types/sale";
import { getShopifyConfig } from "./api-config";

const MAX_RETRIES = 4;
const REQUEST_TIMEOUT_MS = 30_000;

export interface VariantPriceUpdate {
  productId: string;
  variantId: string;
  price: number;
  compareAtPrice?: number | null;
}

export interface VariantPriceUpdateResult {
  successful: number;
  failed: number;
  successfulVariantIds: string[];
  errors: Array<{ variantId: string; error: string }>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGraphQLError(errors: any[]) {
  return errors.some(
    (error) =>
      error?.extensions?.code === "THROTTLED" ||
      /throttl|rate limit|temporar|timeout/i.test(error?.message || "")
  );
}

async function shopifyGraphQL(query: string, variables?: any, storeId?: string) {
  const config = await getShopifyConfig(storeId);
  if (!config.storeUrl || !config.accessToken) {
    throw new Error(`Missing Shopify credentials for store ${storeId || "default_store"}`);
  }

  const endpoint = `https://${config.storeUrl}/admin/api/${config.apiVersion || "2026-07"}/graphql.json`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.accessToken,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      const responseBody = await response.text();
      let payload: any;
      try {
        payload = responseBody ? JSON.parse(responseBody) : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const message = payload?.errors
          ? JSON.stringify(payload.errors)
          : responseBody || `${response.status} ${response.statusText}`;
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === MAX_RETRIES - 1) {
          throw new Error(`Shopify API error ${response.status}: ${message}`);
        }

        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 500 * 2 ** attempt);
        continue;
      }

      if (payload.errors?.length) {
        if (isRetryableGraphQLError(payload.errors) && attempt < MAX_RETRIES - 1) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
      }

      return payload.data;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const retryable = error?.name === "AbortError" || /fetch failed|network|timeout/i.test(error?.message || "");
      if (!retryable || attempt === MAX_RETRIES - 1) throw lastError;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Shopify GraphQL request failed");
}

function mapVariant(node: any): ShopifyVariant {
  return {
    id: node.id,
    title: node.title,
    sku: node.sku,
    price: node.price,
    compareAtPrice: node.compareAtPrice,
  };
}

async function loadAllVariants(
  productId: string,
  initialConnection: any,
  storeId?: string
): Promise<ShopifyVariant[]> {
  const variants = initialConnection.edges.map((edge: any) => mapVariant(edge.node));
  let hasNextPage = initialConnection.pageInfo.hasNextPage;
  let after = initialConnection.pageInfo.endCursor as string | null;

  const query = `
    query getProductVariants($id: ID!, $first: Int!, $after: String) {
      product(id: $id) {
        variants(first: $first, after: $after) {
          edges { node { id title sku price compareAtPrice } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;

  while (hasNextPage) {
    const data = await shopifyGraphQL(query, { id: productId, first: 250, after }, storeId);
    if (!data.product) throw new Error(`Product not found while loading variants: ${productId}`);
    const connection = data.product.variants;
    variants.push(...connection.edges.map((edge: any) => mapVariant(edge.node)));
    hasNextPage = connection.pageInfo.hasNextPage;
    after = connection.pageInfo.endCursor;
  }

  return variants;
}

async function mapProducts(edges: any[], storeId?: string): Promise<ShopifyProduct[]> {
  return Promise.all(
    edges.map(async (edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      productType: edge.node.productType,
      variants: await loadAllVariants(edge.node.id, edge.node.variants, storeId),
    }))
  );
}

export const shopifySaleAPI = {
  async getProducts(params?: {
    first?: number;
    after?: string;
    query?: string;
    storeId?: string;
  }): Promise<{
    products: ShopifyProduct[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  }> {
    const { first = 50, after, query, storeId } = params || {};
    const queryStr = `
      query getProducts($first: Int!, $after: String, $query: String) {
        products(first: $first, after: $after, query: $query) {
          edges {
            node {
              id title productType
              variants(first: 100) {
                edges { node { id title sku price compareAtPrice } }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const data = await shopifyGraphQL(queryStr, { first, after, query }, storeId);
    return {
      products: await mapProducts(data.products.edges, storeId),
      pageInfo: data.products.pageInfo,
    };
  },

  async getAllProducts(query?: string, storeId?: string): Promise<ShopifyProduct[]> {
    const allProducts: ShopifyProduct[] = [];
    let hasNextPage = true;
    let after: string | null = null;
    while (hasNextPage) {
      const result = await this.getProducts({ first: 250, after: after || undefined, query, storeId });
      allProducts.push(...result.products);
      hasNextPage = result.pageInfo.hasNextPage;
      after = result.pageInfo.endCursor;
    }
    return allProducts;
  },

  async getProductsByIds(productIds: string[], storeId?: string): Promise<ShopifyProduct[]> {
    const products: ShopifyProduct[] = [];
    const query = `
      query getProduct($id: ID!) {
        product(id: $id) {
          id title productType
          variants(first: 100) {
            edges { node { id title sku price compareAtPrice } }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `;

    for (const productId of [...new Set(productIds)]) {
      const data = await shopifyGraphQL(query, { id: productId }, storeId);
      if (!data.product) continue;
      products.push({
        id: data.product.id,
        title: data.product.title,
        productType: data.product.productType,
        variants: await loadAllVariants(data.product.id, data.product.variants, storeId),
      });
    }
    return products;
  },

  async getProductsByCollection(collectionId: string, storeId?: string): Promise<ShopifyProduct[]> {
    const query = `
      query getCollectionProducts($id: ID!, $first: Int!, $after: String) {
        collection(id: $id) {
          products(first: $first, after: $after) {
            edges {
              node {
                id title productType
                variants(first: 100) {
                  edges { node { id title sku price compareAtPrice } }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `;
    const allProducts: ShopifyProduct[] = [];
    let hasNextPage = true;
    let after: string | null = null;
    while (hasNextPage) {
      const data = await shopifyGraphQL(query, { id: collectionId, first: 250, after }, storeId);
      if (!data.collection) throw new Error(`Collection not found: ${collectionId}`);
      allProducts.push(...await mapProducts(data.collection.products.edges, storeId));
      hasNextPage = data.collection.products.pageInfo.hasNextPage;
      after = data.collection.products.pageInfo.endCursor;
    }
    return allProducts;
  },

  async getProductsByType(productType: string, storeId?: string): Promise<ShopifyProduct[]> {
    const escapedType = productType.replace(/"/g, "\\\"");
    return this.getAllProducts(`product_type:\"${escapedType}\"`, storeId);
  },

  async getCollections(storeId?: string): Promise<ShopifyCollection[]> {
    const query = `
      query getCollections($first: Int!, $after: String) {
        collections(first: $first, after: $after) {
          edges { node { id title productsCount { count } } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const collections: ShopifyCollection[] = [];
    let hasNextPage = true;
    let after: string | null = null;
    while (hasNextPage) {
      const data = await shopifyGraphQL(query, { first: 250, after }, storeId);
      collections.push(...data.collections.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        productsCount: edge.node.productsCount?.count || 0,
      })));
      hasNextPage = data.collections.pageInfo.hasNextPage;
      after = data.collections.pageInfo.endCursor;
    }
    return collections;
  },

  async getProductTypes(storeId?: string): Promise<string[]> {
    const products = await this.getAllProducts(undefined, storeId);
    return Array.from(new Set(products.map((product) => product.productType).filter(Boolean))).sort();
  },

  async bulkUpdateVariantPrices(
    updates: VariantPriceUpdate[],
    storeId?: string,
    onProgress?: (result: VariantPriceUpdateResult) => Promise<void>
  ): Promise<VariantPriceUpdateResult> {
    const total: VariantPriceUpdateResult = {
      successful: 0,
      failed: 0,
      successfulVariantIds: [],
      errors: [],
    };
    if (updates.length === 0) return total;

    const byProduct = new Map<string, VariantPriceUpdate[]>();
    for (const update of updates) {
      const productUpdates = byProduct.get(update.productId) || [];
      productUpdates.push(update);
      byProduct.set(update.productId, productUpdates);
    }

    const mutation = `
      mutation updateVariantPrices(
        $productId: ID!,
        $variants: [ProductVariantsBulkInput!]!
      ) {
        productVariantsBulkUpdate(
          productId: $productId,
          variants: $variants,
          allowPartialUpdates: true
        ) {
          productVariants { id }
          userErrors { field message }
        }
      }
    `;

    for (const [productId, productUpdates] of byProduct) {
      for (let offset = 0; offset < productUpdates.length; offset += 100) {
        const chunk = productUpdates.slice(offset, offset + 100);
        const batch: VariantPriceUpdateResult = {
          successful: 0,
          failed: 0,
          successfulVariantIds: [],
          errors: [],
        };

        try {
          const data = await shopifyGraphQL(mutation, {
            productId,
            variants: chunk.map((update) => ({
              id: update.variantId,
              price: update.price.toFixed(2),
              compareAtPrice: update.compareAtPrice == null
                ? null
                : update.compareAtPrice.toFixed(2),
            })),
          }, storeId);

          const payload = data.productVariantsBulkUpdate;
          const successfulIds = new Set<string>(
            (payload.productVariants || []).map((variant: any) => variant.id)
          );
          const errorsByIndex = new Map<number, string>();
          for (const userError of payload.userErrors || []) {
            const index = Number((userError.field || []).find((part: string) => /^\d+$/.test(part)));
            if (Number.isInteger(index)) errorsByIndex.set(index, userError.message);
          }

          chunk.forEach((update, index) => {
            if (successfulIds.has(update.variantId)) {
              batch.successful++;
              batch.successfulVariantIds.push(update.variantId);
            } else {
              batch.failed++;
              batch.errors.push({
                variantId: update.variantId,
                error: errorsByIndex.get(index) || "Shopify did not confirm this variant update",
              });
            }
          });
        } catch (error: any) {
          batch.failed = chunk.length;
          batch.errors = chunk.map((update) => ({
            variantId: update.variantId,
            error: error.message || "Shopify update failed",
          }));
        }

        total.successful += batch.successful;
        total.failed += batch.failed;
        total.successfulVariantIds.push(...batch.successfulVariantIds);
        total.errors.push(...batch.errors);
        if (onProgress) await onProgress(batch);
      }
    }

    return total;
  },
};
