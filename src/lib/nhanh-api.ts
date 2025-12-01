import axios, { AxiosInstance } from "axios";
import {
  NhanhCustomer,
  NhanhCustomerSearchParams,
  NhanhCustomerListResponse,
} from "@/types/nhanh";
import { getNhanhConfig } from "./api-config";

class NhanhAPI {
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

  private async getAppId(): Promise<string> {
    const config = await getNhanhConfig();
    return config.appId || "";
  }

  private async getBusinessId(): Promise<string> {
    const config = await getNhanhConfig();
    return config.businessId || "";
  }

  private async getAccessToken(): Promise<string> {
    const config = await getNhanhConfig();
    return config.accessToken || "";
  }

  /**
   * Make API request to Nhanh.vn v3.0
   * According to docs: appId and businessId go in query params, accessToken in Authorization header
   */
  private async request<T>(
    endpoint: string,
    data: Record<string, any> = {},
    retries: number = 3
  ): Promise<T> {
    let lastError: any;
    const appId = await this.getAppId();
    const businessId = await this.getBusinessId();
    const accessToken = await this.getAccessToken();

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Build URL with query params
        const url = `${endpoint}?appId=${appId}&businessId=${businessId}`;

        const response = await this.client.post(url, data, {
          headers: {
            'Authorization': accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (response.data.code !== 1) {
          throw new Error(response.data.messages || response.data.errorCode || "Nhanh API request failed");
        }

        // Return the full response data (includes data array and paginator)
        return response.data as T;
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;

        // Retry on 429 Rate Limit or 5xx errors
        if ((status === 429 || status >= 500) && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential: 2s, 4s, 8s
          console.log(
            `Nhanh API ${status} error, retrying in ${delay}ms... (attempt ${attempt}/${retries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Don't retry on other errors
        console.error("Nhanh API Error:", error.response?.data || error.message);
        throw new Error(
          error.response?.data?.messages || error.response?.data?.errorCode || error.message || "Nhanh API request failed"
        );
      }
    }

    // All retries failed
    throw new Error(
      lastError.response?.data?.messages || lastError.message || "Nhanh API request failed after retries"
    );
  }

  /**
   * Get list of customers with cursor-based pagination
   */
  async getCustomers(
    params: NhanhCustomerSearchParams = {}
  ): Promise<NhanhCustomerListResponse> {
    const { 
      page = 1, 
      limit = 50, 
      name, 
      phone, 
      email, 
      next,
      type,
      lastBoughtDateFrom,
      lastBoughtDateTo,
      mobile,
      id,
      updatedAtFrom,
      updatedAtTo
    } = params;

    // Build filters according to Nhanh API v3.0 docs
    const filters: any = {};

    // Add filters if provided
    if (type !== undefined) filters.type = type;
    if (phone) filters.mobile = phone;
    if (mobile) filters.mobile = mobile;
    if (id) filters.id = id;
    if (lastBoughtDateFrom) filters.lastBoughtDateFrom = lastBoughtDateFrom;
    if (lastBoughtDateTo) filters.lastBoughtDateTo = lastBoughtDateTo;
    if (updatedAtFrom) filters.updatedAtFrom = updatedAtFrom;
    if (updatedAtTo) filters.updatedAtTo = updatedAtTo;

    const requestData: any = {
      filters,
      paginator: {
        size: limit,
      },
    };

    // Add next cursor if provided (for subsequent pages)
    if (next) {
      requestData.paginator.next = next;
    }

    const apiResponse = await this.request<any>("/v3.0/customer/list", requestData);

    // API returns { data: [...], paginator: { next: {...} } }
    const responseData = apiResponse.data || [];
    const responsePaginator = apiResponse.paginator || {};
    
    console.log("Nhanh API Response:", {
      dataLength: Array.isArray(responseData) ? responseData.length : 0,
      hasNext: !!responsePaginator.next,
      nextCursor: responsePaginator.next,
    });
    
    // Transform response to match our interface
    const customers: NhanhCustomer[] = (Array.isArray(responseData) ? responseData : []).map((c: any) => ({
      id: c.id?.toString() || "",
      name: c.name || "",
      phone: c.mobile || "",
      email: c.email || "",
      address: c.address || "",
      city: c.cityName || c.locations?.cityName || "",
      district: c.districtName || c.locations?.districtName || "",
      ward: c.wardName || c.locations?.wardName || "",
      totalSpent: parseFloat(c.totalAmount?.toString() || "0"),
      totalOrders: parseInt(c.frequencyBought?.toString() || "0"),
      createdAt: c.startedDate || "",
      updatedAt: c.updatedAt ? new Date(c.updatedAt * 1000).toISOString() : "",
      status: c.type || 1,
      gender: c.gender || "",
      birthday: c.birthday || "",
      note: c.note || "",
    }));

    // Filter by name or email client-side if needed
    let filteredCustomers = customers;
    if (name) {
      const searchTerm = name.toLowerCase();
      filteredCustomers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm) ||
          c.email?.toLowerCase().includes(searchTerm) ||
          c.phone.includes(searchTerm)
      );
    }

    return {
      customers: filteredCustomers,
      total: responsePaginator.total || filteredCustomers.length,
      page: page,
      limit: limit,
      next: responsePaginator.next,
      hasMore: !!responsePaginator.next,
    };
  }

  /**
   * Get all customers (fetch all pages)
   */
  async getAllCustomers(limit: number = 100): Promise<NhanhCustomer[]> {
    const allCustomers: NhanhCustomer[] = [];
    let nextCursor: any = undefined;
    let hasMore = true;
    let pageCount = 0;

    console.log("Starting to fetch all customers with limit:", limit);

    while (hasMore) {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);
      
      const response = await this.getCustomers({
        limit,
        next: nextCursor,
      });

      console.log(`Page ${pageCount} result:`, {
        customersInPage: response.customers.length,
        totalSoFar: allCustomers.length + response.customers.length,
        hasNext: !!response.next,
        hasMore: response.hasMore,
      });

      allCustomers.push(...response.customers);
      nextCursor = response.next;
      hasMore = response.hasMore;

      // Add small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Finished fetching all customers. Total: ${allCustomers.length} customers in ${pageCount} pages`);
    return allCustomers;
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<NhanhCustomer> {
    const response = await this.request<any>("/v3.0/customer/detail", {
      id: parseInt(customerId),
    });

    const c = response;
    return {
      id: c.id?.toString() || "",
      name: c.name || "",
      phone: c.mobile || "",
      email: c.email || "",
      address: c.address || "",
      city: c.cityName || c.locations?.cityName || "",
      district: c.districtName || c.locations?.districtName || "",
      ward: c.wardName || c.locations?.wardName || "",
      totalSpent: parseFloat(c.totalAmount?.toString() || "0"),
      totalOrders: parseInt(c.frequencyBought?.toString() || "0"),
      createdAt: c.startedDate || "",
      updatedAt: c.updatedAt ? new Date(c.updatedAt * 1000).toISOString() : "",
      status: c.type || 1,
      gender: c.gender || "",
      birthday: c.birthday || "",
      note: c.note || "",
    };
  }

  /**
   * Search customers by email or phone
   */
  async searchCustomers(query: string): Promise<NhanhCustomer[]> {
    const response = await this.getCustomers({
      limit: 20,
      name: query,
    });
    return response.customers;
  }

  /**
   * Get customer's total spent amount
   * Uses the list API with ID filter to get accurate real-time data
   */
  async getCustomerTotalSpent(customerId: string): Promise<number> {
    try {
      const requestData: any = {
        filters: {
          type: 1,
          id: parseInt(customerId),
        },
        paginator: {
          size: 1,
        },
      };

      const apiResponse = await this.request<any>("/v3.0/customer/list", requestData);
      
      // API returns { data: [...], paginator: {...} }
      const customers = apiResponse.data || [];
      
      if (customers.length > 0 && customers[0].id === parseInt(customerId)) {
        const totalAmount = parseFloat(customers[0].totalAmount?.toString() || "0");
        console.log(`Customer ${customerId} total spent: ${totalAmount}`);
        return totalAmount;
      }
      
      console.warn(`Customer ${customerId} not found in API response`);
      return 0;
    } catch (error) {
      console.error("Error getting customer total spent:", error);
      return 0;
    }
  }

  /**
   * Verify webhook signature (if Nhanh provides webhook signature)
   */
  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    // Implement webhook verification if Nhanh provides signature
    // For now, return true
    return true;
  }
}

// Export singleton instance
export const nhanhAPI = new NhanhAPI();
