# API Documentation

## Base URL
```
http://localhost:3000/api
```

---

## Nhanh.vn API Endpoints

### Get Customers List
```http
GET /api/nhanh/customers?page=1&limit=50&keyword=
```

**Query Parameters:**
- `page` (optional): Page number, default: 1
- `limit` (optional): Items per page, default: 50
- `keyword` (optional): Search keyword

**Response:**
```json
{
  "success": true,
  "data": {
    "customers": [...],
    "total": 100,
    "page": 1,
    "limit": 50
  }
}
```

### Get Customer Detail
```http
GET /api/nhanh/customer/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John Doe",
    "phone": "0123456789",
    "email": "john@example.com",
    "totalSpent": 1500000,
    ...
  }
}
```

### Search Customers
```http
POST /api/nhanh/search
```

**Body:**
```json
{
  "query": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": [...]
}
```

---

## Shopify API Endpoints

### Search Customers
```http
POST /api/shopify/search
```

**Body:**
```json
{
  "query": "john",
  "email": "john@example.com",
  "phone": "0123456789"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "gid://shopify/Customer/123",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      ...
    }
  ]
}
```

### Get Customer Detail
```http
GET /api/shopify/customer/{id}
```

### Update Customer Metafield
```http
POST /api/shopify/update-metafield
```

**Body:**
```json
{
  "customerId": "gid://shopify/Customer/123",
  "namespace": "nhanh",
  "key": "total_spent",
  "value": "1500000",
  "type": "number_decimal"
}
```

---

## Mapping & Sync API Endpoints

### Get All Mappings
```http
GET /api/sync/mapping?page=1&limit=50&status=SYNCED
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status (UNMAPPED, PENDING, SYNCED, FAILED)

**Response:**
```json
{
  "success": true,
  "data": {
    "mappings": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2
    }
  }
}
```

### Create Mapping
```http
POST /api/sync/mapping
```

**Body:**
```json
{
  "nhanhCustomerId": "123",
  "nhanhCustomerName": "John Doe",
  "nhanhCustomerPhone": "0123456789",
  "nhanhCustomerEmail": "john@example.com",
  "nhanhTotalSpent": 1500000,
  "shopifyCustomerId": "gid://shopify/Customer/456",
  "shopifyCustomerEmail": "john@example.com",
  "shopifyCustomerName": "John Doe"
}
```

### Get Mapping Detail
```http
GET /api/sync/mapping/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "nhanhCustomerId": "123",
    "shopifyCustomerId": "gid://shopify/Customer/456",
    "syncStatus": "SYNCED",
    "lastSyncedAt": "2024-01-01T00:00:00Z",
    "syncLogs": [...]
  }
}
```

### Update Mapping
```http
PATCH /api/sync/mapping/{id}
```

**Body:**
```json
{
  "shopifyCustomerId": "gid://shopify/Customer/456",
  "shopifyCustomerEmail": "john@example.com",
  "shopifyCustomerName": "John Doe",
  "syncStatus": "PENDING"
}
```

### Delete Mapping
```http
DELETE /api/sync/mapping?id={mappingId}
```

### Sync Single Customer
```http
POST /api/sync/sync-customer
```

**Body:**
```json
{
  "mappingId": "clx..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "syncStatus": "SYNCED",
    "lastSyncedAt": "2024-01-01T00:00:00Z",
    ...
  },
  "message": "Customer synced successfully"
}
```

### Bulk Sync
```http
POST /api/sync/bulk-sync
```

**Body:**
```json
{
  "mappingIds": ["clx1...", "clx2...", "clx3..."]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 3,
    "successful": 2,
    "failed": 1,
    "details": [
      {
        "mappingId": "clx1...",
        "success": true,
        "totalSpent": 1500000
      },
      {
        "mappingId": "clx2...",
        "success": false,
        "error": "Customer not found"
      }
    ]
  },
  "message": "Bulk sync completed: 2 successful, 1 failed"
}
```

### Webhook Endpoint
```http
POST /api/sync/webhook
```

**Headers:**
```
X-Nhanh-Signature: {signature}
```

**Body:**
```json
{
  "event": "customer.updated",
  "data": {
    "customerId": "123",
    "customerInfo": {...}
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (missing parameters)
- `401` - Unauthorized (invalid webhook signature)
- `404` - Not Found
- `409` - Conflict (duplicate mapping)
- `500` - Internal Server Error

---

## Client-Side Usage

Use the provided API client helper:

```typescript
import { nhanhClient, shopifyClient, syncClient } from "@/lib/api-client";

// Get Nhanh customers
const { customers, total } = await nhanhClient.getCustomers({ page: 1, limit: 50 });

// Search Shopify customers
const shopifyCustomers = await shopifyClient.searchCustomers({ 
  email: "john@example.com" 
});

// Create mapping
const mapping = await syncClient.createMapping({
  nhanhCustomerId: "123",
  nhanhCustomerName: "John Doe",
  shopifyCustomerId: "gid://shopify/Customer/456"
});

// Sync customer
await syncClient.syncCustomer(mapping.id);
```

---

## Webhook Setup

To enable auto-sync via webhooks:

1. Register webhook URL in Nhanh.vn:
   ```
   https://your-domain.com/api/sync/webhook
   ```

2. Configure webhook events:
   - `customer.updated`
   - `order.completed`
   - `order.paid`

3. Set webhook secret in `.env`:
   ```
   WEBHOOK_SECRET=your_random_secret_here
   ```

The system will automatically sync customer data when webhooks are received.
