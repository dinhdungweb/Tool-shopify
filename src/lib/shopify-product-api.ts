import axios, { AxiosInstance } from "axios";
import { ShopifyProduct } from "@/types/product";
import { getShopifyConfig } from "./api-config";

class ShopifyProductAPI {
  constructor() {
    // No initialization needed - client created fresh each time
  }

  private async initializeClient(): Promise<AxiosInstance> {
    const config = await getShopifyConfig();
    const shopDomain = config.storeUrl || "";
    const accessToken = config.accessToken || "";
    const apiVersion = "2024-01";

    return axios.create({
      baseURL: `https://${shopDomain}/admin/api/${apiVersion}`,
      timeout: 30000,
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
  }

  private async getClient(): Promise<AxiosInstance> {
    // Always get fresh config from database
    return this.initializeClient();
  }

  /**
   * Get all active products from Shopify using REST API with since_id
   */
  async getAllProductsREST(): Promise<ShopifyProduct[]> {
    const client = await this.getClient();
    const allProducts: ShopifyProduct[] = [];
    let sinceId = 0;
    let pageCount = 0;
    let hasMore = true;

    console.log("Starting to fetch all active Shopify products using REST API...");

    while (hasMore) {
      pageCount++;
      console.log(`Fetching page ${pageCount} (since_id: ${sinceId})...`);

      const url = `/products.json?limit=250&status=active&since_id=${sinceId}`;

      try {
        const response = await client.get(url);
        const products = response.data.products || [];

        console.log(`Page ${pageCount}: Fetched ${products.length} products`);

        if (products.length === 0) {
          hasMore = false;
          break;
        }

        // Transform products
        for (const product of products) {
          if (product.status === 'active' && product.variants && product.variants.length > 0) {
            const variant = product.variants[0];
            allProducts.push({
              id: product.id.toString(),
              title: product.title,
              handle: product.handle,
              productType: product.product_type,
              vendor: product.vendor,
              tags: product.tags ? product.tags.split(", ") : [],
              variantId: variant.id.toString(),
              sku: variant.sku || "",
              barcode: variant.barcode || "",
              price: parseFloat(variant.price || "0"),
              compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : undefined,
              inventoryQuantity: variant.inventory_quantity || 0,
              images: product.images ? product.images.map((img: any) => img.src) : [],
            });
          }
        }

        console.log(`Total products so far: ${allProducts.length}`);

        // Update since_id to the last product's ID
        if (products.length > 0) {
          sinceId = products[products.length - 1].id;
          console.log(`Next since_id: ${sinceId}`);
        }

        // If we got less than 250, we're done
        if (products.length < 250) {
          hasMore = false;
          console.log("Received less than 250 products, assuming last page");
        }

        // Small delay to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        console.error(`Error fetching page ${pageCount}:`, error.response?.data || error.message);
        throw error;
      }
    }

    console.log(`✓ Finished fetching all Shopify products. Total: ${allProducts.length} products in ${pageCount} pages`);
    return allProducts;
  }

  /**
   * Get all active products - using REST API with since_id
   */
  async getAllProducts(): Promise<ShopifyProduct[]> {
    return this.getAllProductsREST();
  }

  /**
   * Get all active products from Shopify using GraphQL
   */
  async getAllProductsGraphQL(): Promise<ShopifyProduct[]> {
    const client = await this.getClient();
    const allProducts: ShopifyProduct[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;
    let pageCount = 0;

    console.log("Starting to fetch all active Shopify products using GraphQL...");

    while (hasNextPage) {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);

      const query = `
        query getProducts($cursor: String) {
          products(first: 250, after: $cursor, query: "status:active") {
            edges {
              node {
                id
                title
                handle
                productType
                vendor
                tags
                status
                variants(first: 1) {
                  edges {
                    node {
                      id
                      sku
                      barcode
                      price
                      compareAtPrice
                      inventoryQuantity
                    }
                  }
                }
                images(first: 5) {
                  edges {
                    node {
                      url
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

      try {
        const response: any = await client.post('/graphql.json', {
          query,
          variables: { cursor },
        });

        console.log(`GraphQL Response status: ${response.status}`);

        // Check for GraphQL errors
        if (response.data.errors) {
          console.error('GraphQL errors:', response.data.errors);
          throw new Error(response.data.errors.map((e: any) => e.message).join(', '));
        }

        const data = response.data.data;
        const products = data?.products?.edges || [];
        const pageInfo = data?.products?.pageInfo;

        console.log(`Page ${pageCount}: Fetched ${products.length} products`);
        console.log(`PageInfo:`, JSON.stringify(pageInfo));

        // Transform products
        for (const edge of products) {
          const product = edge.node;
          const variant = product.variants?.edges?.[0]?.node;

          if (variant) {
            // Extract numeric ID from GraphQL ID (gid://shopify/Product/123456)
            const productId = product.id.split('/').pop() || product.id;
            const variantId = variant.id.split('/').pop() || variant.id;

            allProducts.push({
              id: productId,
              title: product.title,
              handle: product.handle,
              productType: product.productType,
              vendor: product.vendor,
              tags: product.tags || [],
              variantId: variantId,
              sku: variant.sku || "",
              barcode: variant.barcode || "",
              price: parseFloat(variant.price || "0"),
              compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : undefined,
              inventoryQuantity: variant.inventoryQuantity || 0,
              images: product.images?.edges?.map((img: any) => img.node.url) || [],
            });
          }
        }

        console.log(`Total products so far: ${allProducts.length}`);

        // Check for next page
        hasNextPage = pageInfo?.hasNextPage || false;
        cursor = pageInfo?.endCursor || null;

        if (hasNextPage) {
          console.log(`Has next page, cursor: ${cursor}`);
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log("No more pages");
        }
      } catch (error: any) {
        console.error(`Error fetching page ${pageCount}:`, error.response?.data || error.message);
        throw error;
      }
    }

    console.log(`✓ Finished fetching all Shopify products. Total: ${allProducts.length} products in ${pageCount} pages`);
    return allProducts;
  }

  /**
   * Search products by keyword, SKU, or barcode
   */
  async searchProducts(params: {
    keyword?: string;
    sku?: string;
    barcode?: string;
  }): Promise<ShopifyProduct[]> {
    const client = await this.getClient();
    const { keyword, sku, barcode } = params;

    let query = "";
    if (keyword) {
      query = `title:*${keyword}*`;
    } else if (sku) {
      query = `sku:${sku}`;
    } else if (barcode) {
      query = `barcode:${barcode}`;
    }

    const url = query ? `/products.json?limit=20&title=${encodeURIComponent(keyword || "")}` : `/products.json?limit=20`;

    const response = await client.get(url);
    const products = response.data.products || [];

    return products.map((product: any) => {
      const variant = product.variants && product.variants.length > 0 ? product.variants[0] : {};
      return {
        id: product.id.toString(),
        title: product.title,
        handle: product.handle,
        productType: product.product_type,
        vendor: product.vendor,
        tags: product.tags ? product.tags.split(", ") : [],
        variantId: variant.id?.toString(),
        sku: variant.sku || "",
        barcode: variant.barcode || "",
        price: parseFloat(variant.price || "0"),
        compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : undefined,
        inventoryQuantity: variant.inventory_quantity || 0,
        images: product.images ? product.images.map((img: any) => img.src) : [],
      };
    });
  }

  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ShopifyProduct> {
    const client = await this.getClient();
    const response = await client.get(`/products/${productId}.json`);
    const product = response.data.product;
    const variant = product.variants && product.variants.length > 0 ? product.variants[0] : {};

    return {
      id: product.id.toString(),
      title: product.title,
      handle: product.handle,
      productType: product.product_type,
      vendor: product.vendor,
      tags: product.tags ? product.tags.split(", ") : [],
      variantId: variant.id?.toString(),
      sku: variant.sku || "",
      barcode: variant.barcode || "",
      price: parseFloat(variant.price || "0"),
      compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : undefined,
      inventoryQuantity: variant.inventory_quantity || 0,
      images: product.images ? product.images.map((img: any) => img.src) : [],
    };
  }

  // Cache for inventory item IDs and location ID
  private inventoryItemCache = new Map<string, string>();
  private locationId: string | null = null;

  /**
   * Get all locations from Shopify
   */
  async getLocations(): Promise<Array<{ id: string; name: string }>> {
    const client = await this.getClient();
    const response = await client.get('/locations.json');
    const locations = response.data.locations || [];

    return locations.map((loc: any) => ({
      id: loc.id.toString(),
      name: loc.name,
    }));
  }

  /**
   * Get primary location ID (cached)
   */
  private async getLocationId(): Promise<string> {
    if (this.locationId) {
      return this.locationId;
    }

    const locations = await this.getLocations();

    if (locations.length === 0) {
      throw new Error("No locations found in Shopify store");
    }

    // Use the first (primary) location
    const locationId = locations[0].id;
    this.locationId = locationId;
    console.log(`[Shopify] Cached location ID: ${locationId}`);
    return locationId;
  }

  /**
   * Get inventory item ID for a variant (cached)
   */
  private async getInventoryItemId(variantId: string): Promise<string> {
    const cached = this.inventoryItemCache.get(variantId);
    if (cached) {
      return cached;
    }

    const client = await this.getClient();
    const response = await client.get(`/variants/${variantId}.json`);
    const inventoryItemId = response.data.variant?.inventory_item_id?.toString();

    if (!inventoryItemId) {
      throw new Error(`Inventory item ID not found for variant ${variantId}`);
    }

    this.inventoryItemCache.set(variantId, inventoryItemId);
    return inventoryItemId;
  }

  /**
   * Update product variant inventory using Inventory API
   * OPTIMIZED: Uses cached location ID and accepts optional inventoryItemId to skip API call
   */
  async updateVariantInventory(
    variantId: string,
    quantity: number,
    inventoryItemId?: string,
    locationId?: string
  ): Promise<{ inventoryItemId: string }> {
    const client = await this.getClient();

    // Get location ID: use provided or default to primary (cached)
    const targetLocationId = locationId || await this.getLocationId();

    // Get inventory item ID (use provided, cache, or fetch)
    let itemId = inventoryItemId;
    if (!itemId) {
      itemId = await this.getInventoryItemId(variantId);
    } else {
      // Cache it for future use
      this.inventoryItemCache.set(variantId, itemId);
    }

    // Set inventory level (only 1 API call if inventoryItemId provided!)
    await client.post(`/inventory_levels/set.json`, {
      location_id: targetLocationId,
      inventory_item_id: itemId,
      available: quantity,
    });

    console.log(`✓ Updated inventory for variant ${variantId}: → ${quantity}`);

    return { inventoryItemId: itemId };
  }

  /**
   * Batch update inventory for multiple variants
   * Pre-fetches all inventory item IDs to minimize API calls
   */
  async batchUpdateVariantInventory(
    updates: Array<{ variantId: string; quantity: number }>
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    const client = await this.getClient();
    const results = { successful: 0, failed: 0, errors: [] as string[] };

    // Get location ID first (1 API call, cached)
    const locationId = await this.getLocationId();

    // Pre-fetch inventory item IDs for variants not in cache
    const uncachedVariantIds = updates
      .map(u => u.variantId)
      .filter(id => !this.inventoryItemCache.has(id));

    if (uncachedVariantIds.length > 0) {
      console.log(`[Shopify] Pre-fetching ${uncachedVariantIds.length} inventory item IDs...`);

      // Fetch in batches of 50 with delay
      for (let i = 0; i < uncachedVariantIds.length; i += 50) {
        const batch = uncachedVariantIds.slice(i, i + 50);
        const ids = batch.join(',');

        try {
          const response = await client.get(`/variants.json?ids=${ids}`);
          const variants = response.data.variants || [];

          for (const variant of variants) {
            if (variant.id && variant.inventory_item_id) {
              this.inventoryItemCache.set(variant.id.toString(), variant.inventory_item_id.toString());
            }
          }
        } catch (error: any) {
          console.error(`[Shopify] Error fetching variants batch:`, error.message);
        }

        // Delay between batches
        if (i + 50 < uncachedVariantIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Now update inventory (only 1 API call per product)
    for (const update of updates) {
      try {
        const inventoryItemId = this.inventoryItemCache.get(update.variantId);

        if (!inventoryItemId) {
          // Fallback: fetch individually
          const inventoryItemIdFetched = await this.getInventoryItemId(update.variantId);
          await client.post(`/inventory_levels/set.json`, {
            location_id: locationId,
            inventory_item_id: inventoryItemIdFetched,
            available: update.quantity,
          });
        } else {
          await client.post(`/inventory_levels/set.json`, {
            location_id: locationId,
            inventory_item_id: inventoryItemId,
            available: update.quantity,
          });
        }

        results.successful++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${update.variantId}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Update product variant price
   */
  async updateVariantPrice(variantId: string, price: number, compareAtPrice?: number): Promise<void> {
    const client = await this.getClient();
    const data: any = {
      variant: {
        id: variantId,
        price: price.toString(),
      },
    };

    if (compareAtPrice !== undefined) {
      data.variant.compare_at_price = compareAtPrice > 0 ? compareAtPrice.toString() : null;
    }

    await client.put(`/variants/${variantId}.json`, data);
  }
}

export const shopifyProductAPI = new ShopifyProductAPI();
