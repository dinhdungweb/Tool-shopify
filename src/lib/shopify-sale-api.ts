// Shopify Sale API Helper
import { ShopifyProduct, ShopifyVariant, ShopifyCollection } from "@/types/sale";

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-01";

function getGraphQLEndpoint() {
  if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error("Missing Shopify credentials");
  }
  return `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

async function shopifyGraphQL(query: string, variables?: any) {
  const GRAPHQL_ENDPOINT = getGraphQLEndpoint();
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN!,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

export const shopifySaleAPI = {
  /**
   * Get products with pagination
   */
  async getProducts(params?: {
    first?: number;
    after?: string;
    query?: string;
  }): Promise<{
    products: ShopifyProduct[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  }> {
    const { first = 50, after, query } = params || {};

    const queryStr = `
      query getProducts($first: Int!, $after: String, $query: String) {
        products(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              title
              productType
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    compareAtPrice
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const data = await shopifyGraphQL(queryStr, { first, after, query });

    const products = data.products.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      productType: edge.node.productType,
      variants: edge.node.variants.edges.map((v: any) => ({
        id: v.node.id,
        title: v.node.title,
        sku: v.node.sku,
        price: v.node.price,
        compareAtPrice: v.node.compareAtPrice,
      })),
    }));

    return {
      products,
      pageInfo: data.products.pageInfo,
    };
  },

  /**
   * Get all products (fetch all pages)
   */
  async getAllProducts(query?: string): Promise<ShopifyProduct[]> {
    let allProducts: ShopifyProduct[] = [];
    let hasNextPage = true;
    let after: string | null = null;

    while (hasNextPage) {
      const result = await this.getProducts({ first: 250, after: after || undefined, query });
      allProducts = [...allProducts, ...result.products];
      hasNextPage = result.pageInfo.hasNextPage;
      after = result.pageInfo.endCursor;
    }

    return allProducts;
  },

  /**
   * Get products by IDs
   */
  async getProductsByIds(productIds: string[]): Promise<ShopifyProduct[]> {
    // For GraphQL, we need to fetch products one by one or use a different approach
    // Since getAllProducts with query doesn't work well with multiple IDs,
    // we'll fetch each product individually
    const allProducts: ShopifyProduct[] = [];
    
    for (const productId of productIds) {
      try {
        const queryStr = `
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              title
              productType
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    price
                    compareAtPrice
                  }
                }
              }
            }
          }
        `;
        
        const data = await shopifyGraphQL(queryStr, { id: productId });
        
        if (data.product) {
          allProducts.push({
            id: data.product.id,
            title: data.product.title,
            productType: data.product.productType,
            variants: data.product.variants.edges.map((v: any) => ({
              id: v.node.id,
              title: v.node.title,
              sku: v.node.sku,
              price: v.node.price,
              compareAtPrice: v.node.compareAtPrice,
            })),
          });
        }
      } catch (error) {
        console.error(`Failed to fetch product ${productId}:`, error);
      }
    }
    
    return allProducts;
  },

  /**
   * Get products by collection
   */
  async getProductsByCollection(collectionId: string): Promise<ShopifyProduct[]> {
    const queryStr = `
      query getCollectionProducts($id: ID!, $first: Int!, $after: String) {
        collection(id: $id) {
          products(first: $first, after: $after) {
            edges {
              node {
                id
                title
                productType
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      sku
                      price
                      compareAtPrice
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    let allProducts: ShopifyProduct[] = [];
    let hasNextPage = true;
    let after: string | null = null;

    while (hasNextPage) {
      const data = await shopifyGraphQL(queryStr, {
        id: collectionId,
        first: 250,
        after,
      });

      const products = data.collection.products.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        productType: edge.node.productType,
        variants: edge.node.variants.edges.map((v: any) => ({
          id: v.node.id,
          title: v.node.title,
          sku: v.node.sku,
          price: v.node.price,
          compareAtPrice: v.node.compareAtPrice,
        })),
      }));

      allProducts = [...allProducts, ...products];
      hasNextPage = data.collection.products.pageInfo.hasNextPage;
      after = data.collection.products.pageInfo.endCursor;
    }

    return allProducts;
  },

  /**
   * Get products by product type
   */
  async getProductsByType(productType: string): Promise<ShopifyProduct[]> {
    const query = `product_type:${productType}`;
    return this.getAllProducts(query);
  },

  /**
   * Get all collections
   */
  async getCollections(): Promise<ShopifyCollection[]> {
    const queryStr = `
      query getCollections($first: Int!, $after: String) {
        collections(first: $first, after: $after) {
          edges {
            node {
              id
              title
              productsCount {
                count
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    let allCollections: ShopifyCollection[] = [];
    let hasNextPage = true;
    let after: string | null = null;

    while (hasNextPage) {
      const data = await shopifyGraphQL(queryStr, { first: 250, after });

      const collections = data.collections.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        productsCount: edge.node.productsCount?.count || 0,
      }));

      allCollections = [...allCollections, ...collections];
      hasNextPage = data.collections.pageInfo.hasNextPage;
      after = data.collections.pageInfo.endCursor;
    }

    return allCollections;
  },

  /**
   * Get all product types
   */
  async getProductTypes(): Promise<string[]> {
    const products = await this.getAllProducts();
    const types = new Set<string>();

    products.forEach((product) => {
      if (product.productType) {
        types.add(product.productType);
      }
    });

    return Array.from(types).sort();
  },

  /**
   * Update variant price using REST API
   */
  async updateVariantPrice(
    variantId: string,
    price: number,
    compareAtPrice?: number | null
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Extract numeric ID from GID
      const numericId = variantId.split("/").pop();
      
      if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
        throw new Error("Missing Shopify credentials");
      }

      const url = `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/variants/${numericId}.json`;
      
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          variant: {
            id: numericId,
            price: price.toString(),
            compare_at_price: compareAtPrice !== undefined && compareAtPrice !== null 
              ? compareAtPrice.toString() 
              : null,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.errors || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Bulk update variant prices (max 100 at a time)
   */
  async bulkUpdateVariantPrices(
    updates: Array<{
      variantId: string;
      price: number;
      compareAtPrice?: number | null;
    }>
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ variantId: string; error: string }>;
  }> {
    console.log(`Starting bulk update for ${updates.length} variants...`);
    
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ variantId: string; error: string }>,
    };

    // Process one by one with delay to respect Shopify rate limit (2 calls/second)
    // Using 600ms delay = ~1.6 calls/second to be safe
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      console.log(`Updating variant ${i + 1}/${updates.length}: ${update.variantId}`);
      
      const result = await this.updateVariantPrice(
        update.variantId,
        update.price,
        update.compareAtPrice
      );

      if (result.success) {
        results.successful++;
        console.log(`✓ Successfully updated ${update.variantId}`);
      } else {
        results.failed++;
        results.errors.push({
          variantId: update.variantId,
          error: result.error || "Unknown error",
        });
        console.error(`✗ Failed to update ${update.variantId}: ${result.error}`);
      }

      // Delay between requests to respect rate limit (2 calls/second)
      // Using 600ms = ~1.6 calls/second to be safe
      if (i < updates.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    console.log(`Bulk update completed: ${results.successful} successful, ${results.failed} failed`);
    return results;
  },
};
