# 🎯 Shopify Pull Customers với Filters

## ✨ **Tính năng mới**

Thêm khả năng filter khi pull Shopify customers, cho phép pull chỉ những customers thỏa mãn điều kiện cụ thể.

### **Filter options:**

1. **All Customers** - Pull tất cả customers (mặc định)
2. **Customers with Accounts** - Chỉ customers đã đăng ký tài khoản (`state:ENABLED`)
3. **Customers with Orders** - Chỉ customers có ít nhất 1 đơn hàng (`orders_count:>0`)
4. **Customers with Email** - Chỉ customers có email (`email:*`)

---

## 🔧 **Implementation**

### **1. Shopify API - Thêm query parameter**

```typescript
async getAllCustomers(
  limit: number = 50, 
  cursor?: string,
  query?: string  // ✅ NEW: Shopify search query
): Promise<{...}> {
  const graphqlQuery = `
    query getCustomers($first: Int!, $after: String, $query: String) {
      customers(first: $first, after: $after, query: $query) {
        edges {
          node { ... }
        }
      }
    }
  `;
  
  const data = await this.graphql(graphqlQuery, { 
    first: limit, 
    after: cursor || null, 
    query: query || null  // ✅ Pass query parameter
  });
}
```

### **2. API Endpoint - Accept filter**

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { query } = body;  // ✅ Get filter from request
  
  pullAllCustomersBackground(query);  // ✅ Pass to background function
  
  return NextResponse.json({
    success: true,
    message: `Background pull started with filter: "${query}"`,
  });
}
```

### **3. Background Function - Use filter**

```typescript
async function pullAllCustomersBackground(query?: string) {
  console.log(`🚀 Starting pull with filter: "${query}"`);
  
  while (hasNextPage) {
    const result = await shopifyAPI.getAllCustomers(
      250, 
      cursor, 
      query  // ✅ Pass filter to API
    );
    // ... process results
  }
}
```

### **4. UI - Dropdown with filter options**

```tsx
<button onClick={() => handlePullShopifyCustomers()}>
  All Customers
</button>

<button onClick={() => handlePullShopifyCustomers("state:ENABLED")}>
  Customers with Accounts
</button>

<button onClick={() => handlePullShopifyCustomers("orders_count:>0")}>
  Customers with Orders
</button>

<button onClick={() => handlePullShopifyCustomers("email:*")}>
  Customers with Email
</button>
```

---

## 📖 **Shopify Query Syntax**

Shopify hỗ trợ nhiều loại query filters:

### **Customer State:**
```
state:ENABLED          # Customers with accounts
state:DISABLED         # Customers without accounts
state:INVITED          # Customers invited but not registered
state:DECLINED         # Customers declined invitation
```

### **Orders:**
```
orders_count:>0        # Has at least 1 order
orders_count:>10       # Has more than 10 orders
orders_count:0         # No orders (new customers)
```

### **Email:**
```
email:*                # Has email
email:*@gmail.com      # Gmail users
email:john@*           # Email starts with "john@"
```

### **Phone:**
```
phone:*                # Has phone number
phone:+84*             # Vietnam phone numbers
```

### **Tags:**
```
tag:VIP                # Has "VIP" tag
tag:wholesale          # Has "wholesale" tag
```

### **Date:**
```
created_at:>2024-01-01           # Created after Jan 1, 2024
updated_at:<2024-12-31           # Updated before Dec 31, 2024
last_order_date:>2024-11-01      # Last order after Nov 1, 2024
```

### **Combine filters:**
```
state:ENABLED AND orders_count:>0           # Registered + has orders
email:* AND orders_count:>5                 # Has email + 5+ orders
state:ENABLED AND tag:VIP                   # Registered VIP customers
```

---

## 🎯 **Use Cases**

### **1. Pull only registered customers:**
```typescript
handlePullShopifyCustomers("state:ENABLED")
```
**Why:** Chỉ quan tâm customers có tài khoản, bỏ qua guest checkout

### **2. Pull active customers:**
```typescript
handlePullShopifyCustomers("orders_count:>0")
```
**Why:** Chỉ pull customers đã mua hàng, bỏ qua customers chưa mua

### **3. Pull VIP customers:**
```typescript
handlePullShopifyCustomers("tag:VIP")
```
**Why:** Chỉ pull customers VIP để sync riêng

### **4. Pull recent customers:**
```typescript
handlePullShopifyCustomers("created_at:>2024-11-01")
```
**Why:** Chỉ pull customers mới tạo trong tháng 11

### **5. Pull customers with complete info:**
```typescript
handlePullShopifyCustomers("email:* AND phone:*")
```
**Why:** Chỉ pull customers có đầy đủ email và phone

---

## 📊 **Performance**

### **Without filter:**
```
Pull all customers: 100,000 customers
Time: ~10-15 minutes
Database size: Large
```

### **With filter (state:ENABLED):**
```
Pull registered customers: 20,000 customers
Time: ~2-3 minutes
Database size: Smaller
```

**Benefits:**
- ✅ Faster pull (fewer customers)
- ✅ Smaller database
- ✅ More relevant data
- ✅ Easier to manage

---

## 🔄 **Progress Tracking**

Mỗi filter có progress tracking riêng:

```typescript
// All customers
progressId = "shopify_customers"

// With filter
progressId = "shopify_customers_c3RhdGU6RU5BQkxFRA"  // base64 encoded
```

**Benefits:**
- ✅ Có thể pull nhiều filters đồng thời
- ✅ Mỗi filter có progress riêng
- ✅ Resume từng filter độc lập

---

## 💡 **Best Practices**

### **1. Start with filters:**
```
✅ Pull registered customers first (state:ENABLED)
✅ Then pull active customers (orders_count:>0)
❌ Don't pull all customers if not needed
```

### **2. Use specific filters:**
```
✅ state:ENABLED AND orders_count:>5
❌ state:ENABLED (too broad)
```

### **3. Test filters first:**
```
1. Test filter in Shopify Admin
2. Verify customer count
3. Then use in pull
```

### **4. Schedule regular pulls:**
```
Daily: Pull new/updated customers
Weekly: Pull all registered customers
Monthly: Full sync all customers
```

---

## 🎨 **UI Features**

### **Dropdown menu:**
- ✅ 4 pre-defined filters
- ✅ Clear descriptions
- ✅ Icons for each option
- ✅ Easy to use

### **Confirmation dialog:**
```
Pull Shopify customers with filter: "state:ENABLED" in background?

⚡ This will run in background and continue even if you close this page.

Check the server console logs for progress.
```

### **Progress logging:**
```
🚀 Starting pull with filter: "state:ENABLED"
📦 Fetching page 1...
  ✅ Fetched 250 customers in 1.2s
  💾 Saved to DB in 0.5s
  📊 Progress: 250 total, Page 1 completed
```

---

## 📝 **Files Changed**

1. **src/lib/shopify-api.ts**
   - Add `query` parameter to `getAllCustomers()`

2. **src/app/api/shopify/pull-customers/route.ts**
   - Accept `query` from request body
   - Pass to background function
   - Use unique progressId per filter

3. **src/lib/api-client.ts**
   - Add `query` parameter to `pullCustomers()`

4. **src/components/customers-sync/CustomerSyncTable.tsx**
   - Replace button with dropdown
   - Add 4 filter options
   - Update confirmation message

---

## 🎉 **Kết luận**

**Đã thêm filter options cho Shopify pull customers!**

**Features:**
- ✅ 4 pre-defined filters
- ✅ Support Shopify query syntax
- ✅ Progress tracking per filter
- ✅ Easy to use dropdown UI

**Benefits:**
- ✅ Faster pulls (fewer customers)
- ✅ More relevant data
- ✅ Flexible filtering
- ✅ Better performance

**Next steps:**
- 🔮 Add custom filter input
- 🔮 Save favorite filters
- 🔮 Filter presets management
- 🔮 Filter analytics

---

## 📚 **References**

- [Shopify Customer Search Syntax](https://shopify.dev/docs/api/admin-graphql/2024-01/queries/customers)
- [Shopify Query Language](https://shopify.dev/docs/api/usage/search-syntax)
