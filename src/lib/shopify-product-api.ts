import axios, { AxiosInstance } from "axios";
import { ShopifyProduct } from "@/types/product";

class ShopifyProductAPI {
  private client: AxiosInstance;

  constructor() {
    const shopDomain = process.env.SHOPIFY_STORE_URL || process.env.SHOPIFY_SHOP_DOMAIN || "";
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || "";
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";

    this.client = axios.create({
      baseURL: `https://${shopDomain}/admin/api/${apiVersion}`,
      timeout: 30000,
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get all active products from Shopify using REST API with since_id
   */
  async getAllProductsREST(): Promise<ShopifyProduct[]> {
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
        const response = await this.client.get(url);
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
        const response = await this.client.post('/graphql.json', {
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
    
    const response = await this.client.get(url);
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
    const response = await this.client.get(`/products/${productId}.json`);
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

  /**
   * Update product variant inventory using Inventory API
   */
  async updateVariantInventory(variantId: string, quantity: number): Promise<void> {
    // Step 1: Get variant to find inventory_item_id
    const variantResponse = await this.client.get(`/variants/${variantId}.json`);
    const variant = variantResponse.data.variant;
    const inventoryItemId = variant.inventory_item_id;

    if (!inventoryItemId) {
      throw new Error("Inventory item ID not found for variant");
    }

    // Step 2: Get inventory levels to find location_id
    const inventoryResponse = await this.client.get(
      `/inventory_levels.json?inventory_item_ids=${inventoryItemId}`
    );
    const inventoryLevels = inventoryResponse.data.inventory_levels || [];

    if (inventoryLevels.length === 0) {
      throw new Error("No inventory locations found for this product");
    }

    // Use the first location (usually the primary location)
    const locationId = inventoryLevels[0].location_id;
    const currentQuantity = inventoryLevels[0].available || 0;

    // Step 3: Set inventory level
    await this.client.post(`/inventory_levels/set.json`, {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: quantity,
    });

    console.log(`✓ Updated inventory for variant ${variantId}: ${currentQuantity} → ${quantity}`);
  }

  /**
   * Update product variant price
   */
  async updateVariantPrice(variantId: string, price: number, compareAtPrice?: number): Promise<void> {
    const data: any = {
      variant: {
        id: variantId,
        price: price.toString(),
      },
    };

    if (compareAtPrice !== undefined) {
      data.variant.compare_at_price = compareAtPrice > 0 ? compareAtPrice.toString() : null;
    }

    await this.client.put(`/variants/${variantId}.json`, data);
  }
}

export const shopifyProductAPI = new ShopifyProductAPI();
