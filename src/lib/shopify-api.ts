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
   * Execute GraphQL query
   */
  private async graphql<T>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
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
      throw new Error(
        error.response?.data?.errors?.[0]?.message ||
        error.message ||
        "Shopify API request failed"
      );
    }
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
    return {
      id: node.id,
      email: node.email || "",
      firstName: node.firstName || "",
      lastName: node.lastName || "",
      phone: node.phone || undefined,
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
  async getAllCustomers(limit: number = 50): Promise<ShopifyCustomer[]> {
    const graphqlQuery = `
      query getCustomers($first: Int!) {
        customers(first: $first) {
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
    }>(graphqlQuery, { first: limit });

    return data.customers.edges.map((edge) => this.formatCustomer(edge.node));
  }
}

// Export singleton instance
export const shopifyAPI = new ShopifyAPI();
