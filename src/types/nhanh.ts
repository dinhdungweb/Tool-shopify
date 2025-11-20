// Nhanh.vn API Types

export interface NhanhCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  district?: string;
  ward?: string;
  totalSpent: number;
  totalOrders: number;
  createdAt: string;
  updatedAt?: string;
  status?: number;
  gender?: string;
  birthday?: string;
  note?: string;
}

export interface NhanhCustomerSearchParams {
  name?: string;
  phone?: string;
  email?: string;
  page?: number;
  limit?: number;
  next?: any; // Cursor for pagination
}

export interface NhanhApiResponse<T> {
  code: number;
  messages: string[];
  data: T;
}

export interface NhanhCustomerListResponse {
  customers: NhanhCustomer[];
  total: number;
  page: number;
  limit: number;
  next?: any; // Next cursor for pagination
  hasMore: boolean;
}

export interface NhanhWebhookPayload {
  event: string;
  data: {
    customerId: string;
    customerInfo?: NhanhCustomer;
    orderId?: string;
    orderTotal?: number;
  };
  timestamp: string;
}
