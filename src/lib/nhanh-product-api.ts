import axios, { AxiosInstance } from "axios";
import { NhanhProduct } from "@/types/product";

interface NhanhProductListResponse {
  products: NhanhProduct[];
  total: number;
  page: number;
  limit: number;
  next?: any;
  hasMore: boolean;
}

class NhanhProductAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: "https://pos.open.nhanh.vn",
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  private get appId(): string {
    return process.env.NHANH_APP_ID || "";
  }

  private get businessId(): string {
    return process.env.NHANH_BUSINESS_ID || "";
  }

  private get accessToken(): string {
    return process.env.NHANH_ACCESS_TOKEN || "";
  }

  private get storeId(): string | undefined {
    return process.env.NHANH_STORE_ID || undefined;
  }

  /**
   * Make API request to Nhanh.vn v3.0
   */
  private async request<T>(
    endpoint: string,
    data: Record<string, any> = {}
  ): Promise<T> {
    try {
      const url = `${endpoint}?appId=${this.appId}&businessId=${this.businessId}`;

      const response = await this.client.post(url, data, {
        headers: {
          'Authorization': this.accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.code !== 1) {
        throw new Error(response.data.messages || response.data.errorCode || "Nhanh API request failed");
      }

      return response.data as T;
    } catch (error: any) {
      console.error("Nhanh Product API Error:", error.response?.data || error.message);
      throw new Error(
        error.response?.data?.messages || error.response?.data?.errorCode || error.message || "Nhanh API request failed"
      );
    }
  }

  /**
   * Get list of products with cursor-based pagination
   * Endpoint: /v3.0/product/list
   */
  async getProducts(params: {
    page?: number;
    limit?: number;
    keyword?: string;
    next?: any;
  } = {}): Promise<NhanhProductListResponse> {
    const { page = 1, limit = 50, keyword, next } = params;

    const filters: any = {};
    
    if (keyword) {
      filters.keyword = keyword;
    }

    const requestData: any = {
      filters,
      paginator: {
        size: limit,
      },
    };

    if (next) {
      requestData.paginator.next = next;
    }

    const apiResponse = await this.request<any>("/v3.0/product/list", requestData);

    const responseData = apiResponse.data || [];
    const responsePaginator = apiResponse.paginator || {};
    
    console.log("Nhanh Product API Response:", {
      dataLength: Array.isArray(responseData) ? responseData.length : 0,
      hasNext: !!responsePaginator.next,
    });
    
    // Transform response
    const products: NhanhProduct[] = (Array.isArray(responseData) ? responseData : []).map((p: any) => ({
      id: p.id?.toString() || "",
      name: p.name || "",
      sku: p.code || "",
      barcode: p.barcode || "",
      price: parseFloat(p.price?.toString() || "0"),
      comparePrice: p.oldPrice ? parseFloat(p.oldPrice.toString()) : undefined,
      quantity: parseInt(p.quantity?.toString() || "0"),
      categoryId: p.categoryId?.toString() || "",
      categoryName: p.categoryName || "",
      brandId: p.brandId?.toString() || "",
      brandName: p.brandName || "",
      description: p.description || "",
      images: p.images || [],
    }));

    return {
      products,
      total: responsePaginator.total || products.length,
      page,
      limit,
      next: responsePaginator.next,
      hasMore: !!responsePaginator.next,
    };
  }

  /**
   * Get product inventory by ID
   * Note: We use /v3.0/product/list with keyword search and then filter by exact ID
   * because the API doesn't support direct productId filtering
   */
  async getProductById(productId: string): Promise<NhanhProduct> {
    // Try keyword search first
    let response = await this.request<any>("/v3.0/product/list", {
      filters: {
        keyword: productId,
      },
      paginator: {
        size: 100,
      },
    });

    let products = response.data || [];
    let product = products.find((p: any) => p.id?.toString() === productId);
    
    // If not found, try fetching multiple pages until we find it
    if (!product) {
      console.log(`Product ${productId} not found in keyword search, fetching all products...`);
      
      let nextCursor: any = undefined;
      let hasMore = true;
      let pageCount = 0;
      const maxPages = 10; // Limit to 10 pages (1000 products) to avoid infinite loop
      
      while (!product && hasMore && pageCount < maxPages) {
        pageCount++;
        console.log(`Fetching page ${pageCount} to find product ${productId}...`);
        
        response = await this.request<any>("/v3.0/product/list", {
          filters: {},
          paginator: {
            size: 100,
            ...(nextCursor ? { next: nextCursor } : {}),
          },
        });
        
        products = response.data || [];
        product = products.find((p: any) => p.id?.toString() === productId);
        
        nextCursor = response.paginator?.next;
        hasMore = !!nextCursor;
        
        // Small delay to avoid rate limiting
        if (!product && hasMore) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    
    if (!product) {
      throw new Error(`Product ${productId} not found in Nhanh.vn after searching ${10} pages. It may have been deleted or archived.`);
    }

    const p = product;
    
    // Get quantity based on depot (warehouse) configuration
    let quantity = 0;
    if (this.storeId) {
      // Get inventory from specific depot
      const depots = p.inventory?.depots || [];
      const targetDepot = depots.find((d: any) => d.id?.toString() === this.storeId);
      if (targetDepot) {
        quantity = parseInt(targetDepot.available?.toString() || "0");
        console.log(`Using inventory from depot ${this.storeId}:`, quantity);
      } else {
        console.warn(`Depot ${this.storeId} not found, using total inventory`);
        quantity = parseInt(p.inventory?.available?.toString() || "0");
      }
    } else {
      // Use total inventory from all depots
      quantity = parseInt(p.inventory?.available?.toString() || "0");
      console.log("Using total inventory from all depots:", quantity);
    }

    return {
      id: p.id?.toString() || "",
      name: p.name || "",
      sku: p.code || "",
      barcode: p.barcode || "",
      price: parseFloat(p.prices?.retail?.toString() || "0"),
      comparePrice: p.prices?.old ? parseFloat(p.prices.old.toString()) : undefined,
      quantity,
      categoryId: p.categoryId?.toString() || "",
      categoryName: "",
      brandId: p.brandId?.toString() || "",
      brandName: "",
      description: "",
      images: p.images?.others || [],
    };
  }

  /**
   * Search products by keyword
   */
  async searchProducts(keyword: string): Promise<NhanhProduct[]> {
    const response = await this.getProducts({
      limit: 20,
      keyword,
    });
    return response.products;
  }

  /**
   * Get all products (fetch all pages)
   */
  async getAllProducts(limit: number = 100): Promise<NhanhProduct[]> {
    const allProducts: NhanhProduct[] = [];
    let nextCursor: any = undefined;
    let hasMore = true;
    let pageCount = 0;

    console.log("Starting to fetch all products with limit:", limit);

    while (hasMore) {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);
      
      const response = await this.getProducts({
        limit,
        next: nextCursor,
      });

      console.log(`Page ${pageCount} result:`, {
        productsInPage: response.products.length,
        totalSoFar: allProducts.length + response.products.length,
        hasNext: !!response.next,
      });

      allProducts.push(...response.products);
      nextCursor = response.next;
      hasMore = response.hasMore;

      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Finished fetching all products. Total: ${allProducts.length} products in ${pageCount} pages`);
    return allProducts;
  }
}

export const nhanhProductAPI = new NhanhProductAPI();
