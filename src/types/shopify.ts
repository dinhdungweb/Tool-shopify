// Shopify API Types

export interface ShopifyCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  defaultAddressPhone?: string;
  totalSpent: string;
  ordersCount: number;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  note?: string;
  metafields?: ShopifyMetafield[];
}

export interface ShopifyMetafield {
  id?: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface ShopifyCustomerSearchParams {
  query?: string;
  email?: string;
  phone?: string;
  limit?: number;
}

export interface ShopifyGraphQLResponse<T> {
  data: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export interface ShopifyCustomerConnection {
  customers: {
    edges: Array<{
      node: ShopifyCustomer;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string;
      endCursor?: string;
    };
  };
}

export interface ShopifyMetafieldInput {
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface ShopifyCustomerUpdateInput {
  id: string;
  metafields?: ShopifyMetafieldInput[];
}
