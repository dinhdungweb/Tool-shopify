import axios, { AxiosInstance } from "axios";
import {
  ShopifyCustomer,
  ShopifyCustomerSearchParams,
  ShopifyGraphQLResponse,
  ShopifyMetafieldInput,
} from "@/types/shopify";

class ShopifyAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  private get graphqlEndpoint(): string {
    const storeUrl = process.env.SHOPIFY_STORE_URL || "";
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";
    return `https://${storeUrl}/admin/api/${apiVersion}/graphql.json`;
  }

  private get accessToken(): string {
    return process.env.SHOPIFY_ACCESS_TOKEN || "";
  }

  /**
   * Execute GraphQL query with retry logic for 502 errors
   */
  private async graphql<T>(
    query: string,
    variables?: Record<string, any>,
    retries: number = 3
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.post<ShopifyGraphQLResponse<T>>(
          this.graphqlEndpoint,
          { query, variables },
          {
            headers: {
              "X-Shopify-Access-Token": this.accessToken,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.errors) {
          throw new Error(
            response.data.errors.map((e) => e.message).join(", ")
          );
        }

        return response.data.data;
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;

        // Retry on 502 Bad Gateway or 503 Service Unavailable
        if ((status === 502 || status === 503) && attempt < retries) {
          const delay = attempt * 2000; // 2s, 4s, 6s
          console.log(
            `Shopify API ${status} error, retrying in ${delay}ms... (attempt ${attempt}/${retries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Don't retry on other errors
        throw new Error(
          error.response?.data?.errors?.[0]?.message ||
            error.message ||
            "Shopify API request failed"
        );
      }
    }

    // All retries failed
    throw new Error(
      lastError.response?.data?.errors?.[0]?.message ||
        lastError.message ||
        "Shopify API request failed after retries"
    );
  }

  /**
   * Search customers
   */
  async searchCustomers(
    params: ShopifyCustomerSearchParams
  ): Promise<ShopifyCustomer[]> {
    const { query, email, phone, limit = 20 } = params;

    let searchQuery = "";
    if (email) {
      searchQuery = `email:${email}`;
    } else if (phone) {
      searchQuery = `phone:${phone}`;
    } else if (query) {
      searchQuery = query;
    }

    const graphqlQuery = `
      query searchCustomers($query: String!, $first: Int!) {
        customers(first: $first, query: $query) {
          edges {
            node {
              id
              email
              firstName
              lastName
              phone
              createdAt
              updatedAt
              numberOfOrders
              amountSpent {
                amount
              }
              defaultAddress {
                phone
              }
              metafields(first: 10) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.graphql<{
      customers: {
        edges: Array<{
          node: any;
        }>;
      };
    }>(graphqlQuery, {
      query: searchQuery,
      first: limit,
    });

    return data.customers.edges.map((edge) => this.formatCustomer(edge.node));
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: string): Promise<ShopifyCustomer | null> {
    const graphqlQuery = `
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          phone
          createdAt
          updatedAt
          numberOfOrders
          amountSpent {
            amount
          }
          metafields(first: 10) {
            edges {
              node {
                id
                namespace
                key
                value
                type
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.graphql<{ customer: any }>(graphqlQuery, {
        id: customerId,
      });

      if (!data.customer) {
        return null;
      }

      return this.formatCustomer(data.customer);
    } catch (error) {
      console.error("Error getting customer:", error);
      return null;
    }
  }

  /**
   * Update customer metafield
   */
  async updateCustomerMetafield(
    customerId: string,
    metafield: ShopifyMetafieldInput
  ): Promise<boolean> {
    const mutation = `
      mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            metafields(first: 10) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const data = await this.graphql<{
        customerUpdate: {
          customer: any;
          userErrors: Array<{ field: string[]; message: string }>;
        };
      }>(mutation, {
        input: {
          id: customerId,
          metafields: [
            {
              namespace: metafield.namespace,
              key: metafield.key,
              value: metafield.value,
              type: metafield.type,
            },
          ],
        },
      });

      if (data.customerUpdate.userErrors.length > 0) {
        throw new Error(
          data.customerUpdate.userErrors.map((e) => e.message).join(", ")
        );
      }

      return true;
    } catch (error) {
      console.error("Error updating customer metafield:", error);
      throw error;
    }
  }

  /**
   * Update customer's total spent from Nhanh.vn
   */
  async syncCustomerTotalSpent(
    customerId: string,
    totalSpent: number
  ): Promise<boolean> {
    return this.updateCustomerMetafield(customerId, {
      namespace: "custom",
      key: "total_spent",
      value: totalSpent.toString(),
      type: "number_integer",
    });
  }

  /**
   * Format customer data from GraphQL response
   */
  private formatCustomer(node: any): ShopifyCustomer {
    // Use phone from customer, fallback to defaultAddress phone
    const phone = node.phone || node.defaultAddress?.phone || undefined;
    
    return {
      id: node.id,
      email: node.email || "",
      firstName: node.firstName || "",
      lastName: node.lastName || "",
      phone: phone,
      totalSpent: node.amountSpent?.amount || "0",
      ordersCount: node.numberOfOrders || 0,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      metafields: node.metafields?.edges?.map((edge: any) => ({
        id: edge.node.id,
        namespace: edge.node.namespace,
        key: edge.node.key,
        value: edge.node.value,
        type: edge.node.type,
      })) || [],
    };
  }

  /**
   * Get all customers (paginated)
   */
  async getAllCustomers(limit: number = 50, cursor?: string): Promise<{
    customers: ShopifyCustomer[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  }> {
    const graphqlQuery = `
      query getCustomers($first: Int!, $after: String) {
        customers(first: $first, after: $after) {
          edges {
            node {
              id
              email
              firstName
              lastName
              phone
              createdAt
              updatedAt
              numberOfOrders
              amountSpent {
                amount
              }
              defaultAddress {
                phone
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const data = await this.graphql<{
      customers: {
        edges: Array<{
          node: any;
          cursor: string;
        }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string;
        };
      };
    }>(graphqlQuery, { first: limit, after: cursor || null });

    return {
      customers: data.customers.edges.map((edge) => this.formatCustomer(edge.node)),
      pageInfo: {
        hasNextPage: data.customers.pageInfo.hasNextPage,
        endCursor: data.customers.pageInfo.endCursor,
      },
    };
  }
}

// Export singleton instance
export const shopifyAPI = new ShopifyAPI();
