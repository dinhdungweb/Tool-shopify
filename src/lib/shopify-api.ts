import axios, { AxiosInstance } from "axios";
import {
  ShopifyCustomer,
  ShopifyCustomerSearchParams,
  ShopifyGraphQLResponse,
  ShopifyMetafieldInput,
} from "@/types/shopify";
import { getShopifyConfig } from "./api-config";

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

  private async getGraphqlEndpoint(): Promise<string> {
    const config = await getShopifyConfig();
    const storeUrl = config.storeUrl || "";
    const apiVersion = "2024-01";
    return `https://${storeUrl}/admin/api/${apiVersion}/graphql.json`;
  }

  private async getAccessToken(): Promise<string> {
    const config = await getShopifyConfig();
    return config.accessToken || "";
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
    const endpoint = await this.getGraphqlEndpoint();
    const accessToken = await this.getAccessToken();

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.post<ShopifyGraphQLResponse<T>>(
          endpoint,
          { query, variables },
          {
            headers: {
              "X-Shopify-Access-Token": accessToken,
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

        // Retry on 429 Rate Limit with exponential backoff
        if (status === 429 && attempt < retries) {
          const retryAfter = error.response?.headers?.['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000; // Exponential: 2s, 4s, 8s
          console.log(
            `Shopify API rate limit (429), retrying in ${delay}ms... (attempt ${attempt}/${retries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

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
        const errorDetail =
          error.response?.data?.errors?.[0]?.message ||
          JSON.stringify(error.response?.data) ||
          error.message ||
          "Shopify API request failed";

        console.error(`Shopify API Error (${status}):`, errorDetail);

        throw new Error(errorDetail);
      }
    }

    // All retries failed
    const finalError =
      lastError.response?.data?.errors?.[0]?.message ||
      JSON.stringify(lastError.response?.data) ||
      lastError.message ||
      "Shopify API request failed after retries";

    throw new Error(finalError);
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
    } catch (error: any) {
      console.error("Error updating customer metafield:", error.message || JSON.stringify(error));
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
    // Round to integer since Shopify metafield type is number_integer
    const roundedValue = Math.round(totalSpent);
    return this.updateCustomerMetafield(customerId, {
      namespace: "custom",
      key: "total_spent",
      value: roundedValue.toString(),
      type: "number_integer",
    });
  }

  /**
   * Format customer data from GraphQL response
   */
  private formatCustomer(node: any): ShopifyCustomer {
    return {
      id: node.id,
      email: node.email || "",
      firstName: node.firstName || "",
      lastName: node.lastName || "",
      phone: node.phone || undefined,
      defaultAddressPhone: node.defaultAddress?.phone || undefined,
      note: node.note || undefined,
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
   * Get all customers (paginated) with optional filters
   */
  async getAllCustomers(
    limit: number = 50,
    cursor?: string,
    query?: string
  ): Promise<{
    customers: ShopifyCustomer[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  }> {
    const graphqlQuery = `
      query getCustomers($first: Int!, $after: String, $query: String) {
        customers(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              email
              firstName
              lastName
              phone
              note
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
    }>(graphqlQuery, { first: limit, after: cursor || null, query: query || null });

    return {
      customers: data.customers.edges.map((edge) => this.formatCustomer(edge.node)),
      pageInfo: {
        hasNextPage: data.customers.pageInfo.hasNextPage,
        endCursor: data.customers.pageInfo.endCursor,
      },
    };
  }

  /**
   * Update inventory quantity for a product variant
   */
  async updateInventory(variantId: string, quantity: number): Promise<void> {
    const mutation = `
      mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
        inventorySetQuantities(input: $input) {
          inventoryAdjustmentGroup {
            id
            reason
            changes {
              name
              delta
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Get inventory item ID from variant ID
    const inventoryItemQuery = `
      query getInventoryItem($id: ID!) {
        productVariant(id: $id) {
          inventoryItem {
            id
          }
        }
      }
    `;

    const variantData = await this.graphql<{
      productVariant: {
        inventoryItem: {
          id: string;
        };
      };
    }>(inventoryItemQuery, {
      id: `gid://shopify/ProductVariant/${variantId}`,
    });

    const inventoryItemId = variantData.productVariant.inventoryItem.id;

    // Get location ID (first available location)
    const locationsQuery = `
      query {
        locations(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;

    const locationsData = await this.graphql<{
      locations: {
        edges: Array<{
          node: {
            id: string;
          };
        }>;
      };
    }>(locationsQuery);

    const locationId = locationsData.locations.edges[0].node.id;

    // Update inventory
    const result = await this.graphql<{
      inventorySetQuantities: {
        inventoryAdjustmentGroup: any;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, {
      input: {
        reason: "correction",
        name: "available",
        quantities: [
          {
            inventoryItemId,
            locationId,
            quantity,
          },
        ],
      },
    });

    if (result.inventorySetQuantities.userErrors.length > 0) {
      throw new Error(
        result.inventorySetQuantities.userErrors
          .map((e) => e.message)
          .join(", ")
      );
    }
  }

  /**
   * Get shop information
   */
  async getShopInfo(): Promise<{
    name: string;
    domain: string;
    email: string;
  }> {
    const query = `
      query {
        shop {
          name
          primaryDomain {
            host
          }
          email
        }
      }
    `;

    const response = await this.graphql<{
      shop: {
        name: string;
        primaryDomain: { host: string };
        email: string;
      };
    }>(query);

    return {
      name: response.shop.name,
      domain: response.shop.primaryDomain.host,
      email: response.shop.email,
    };
  }
}

// Export singleton instance
export const shopifyAPI = new ShopifyAPI();
