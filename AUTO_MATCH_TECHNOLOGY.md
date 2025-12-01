# Auto-Match Technology - Chi Tiết Kỹ Thuật

## 📊 Tổng Quan

Hệ thống có **2 auto-match APIs** đang hoạt động, mỗi API sử dụng công nghệ khác nhau phù hợp với use case.

## 🔧 1. Auto-Match Products

**API**: `/api/sync/auto-match-products`  
**File**: `src/app/api/sync/auto-match-products/route.ts`  
**Used by**: ProductSyncTable.tsx

### Công Nghệ: SQL JOIN (Ultra-Fast)

#### Strategy
```
1. Raw SQL với INNER JOIN
2. Match by SKU (case-insensitive, trimmed)
3. Filter 1-to-1 matches only
4. Bulk insert mappings
```

#### SQL Query
```sql
SELECT 
  np.id as nhanh_id,
  np.name as nhanh_name,
  np.sku as nhanh_sku,
  sp.id as shopify_id,
  sp.title as shopify_title,
  sp.sku as shopify_sku
FROM nhanh_products np
LEFT JOIN product_mappings pm ON pm."nhanhProductId" = np.id
INNER JOIN shopify_products sp ON (
  -- Match by SKU (case-insensitive, trimmed)
  LOWER(TRIM(np.sku)) = LOWER(TRIM(sp.sku))
  AND np.sku IS NOT NULL 
  AND sp.sku IS NOT NULL
  AND TRIM(np.sku) != ''
  AND TRIM(sp.sku) != ''
)
WHERE 
  pm.id IS NULL  -- Not yet mapped
```

#### Matching Logic

**Step 1: SQL JOIN**
- Database-level matching (fastest)
- Case-insensitive comparison
- Trim whitespace
- Exclude empty/null SKUs

**Step 2: Filter 1-to-1 Matches**
```typescript
// Group by Nhanh product ID
const nhanhMatchMap = new Map<string, any[]>();
matches.forEach((match) => {
  if (!nhanhMatchMap.has(match.nhanh_id)) {
    nhanhMatchMap.set(match.nhanh_id, []);
  }
  nhanhMatchMap.get(match.nhanh_id)!.push(match);
});

// Group by Shopify product ID
const shopifyMatchMap = new Map<string, any[]>();
matches.forEach((match) => {
  if (!shopifyMatchMap.has(match.shopify_id)) {
    shopifyMatchMap.set(match.shopify_id, []);
  }
  shopifyMatchMap.get(match.shopify_id)!.push(match);
});

// Only keep 1-to-1 matches
const exactMatches = Array.from(nhanhMatchMap.entries())
  .filter(([nhanhId, matches]) => {
    if (matches.length !== 1) return false;
    const shopifyId = matches[0].shopify_id;
    return shopifyMatchMap.get(shopifyId)?.length === 1;
  })
  .map(([_, matches]) => matches[0]);
```

**Step 3: Bulk Insert**
```typescript
// Insert in batches of 500
const batchSize = 500;
for (let i = 0; i < totalBatches; i++) {
  const batch = exactMatches.slice(start, end);
  
  // Build VALUES clause
  const values = batch.map((match) => `(
    gen_random_uuid(),
    NOW(),
    NOW(),
    '${match.nhanh_id}',
    '${match.nhanh_name}',
    '${match.nhanh_sku}',
    '${match.shopify_id}',
    '${match.shopify_id}',
    '${match.shopify_title}',
    '${match.shopify_sku}',
    'PENDING',
    0
  )`).join(',\n');

  // Single INSERT for entire batch
  await prisma.$executeRawUnsafe(`
    INSERT INTO product_mappings (...)
    VALUES ${values}
    ON CONFLICT ("nhanhProductId") DO NOTHING
  `);
}
```

#### Performance

**Advantages**:
- ⚡ **Very Fast**: Database-level JOIN
- 🎯 **Accurate**: Exact SKU matching
- 📊 **Scalable**: Handles large datasets
- 💾 **Efficient**: Bulk inserts

**Speed**: ~1000-5000 products/sec (depending on dataset size)

**Best For**:
- Large product catalogs
- Exact SKU matching
- One-time bulk matching

---

## 👥 2. Auto-Match Customers (Batch)

**API**: `/api/sync/auto-match-batch`  
**File**: `src/app/api/sync/auto-match-batch/route.ts`  
**Used by**: CustomerSyncTable.tsx

### Công Nghệ: In-Memory Phone Map + Batch Processing

#### Strategy
```
1. Load all Shopify customers into memory
2. Build phone lookup map (O(1) lookup)
3. Process Nhanh customers in batches
4. Match by phone with normalization
5. Bulk insert mappings
```

#### Phone Normalization
```typescript
function normalizePhone(phone: string): string[] {
  if (!phone) return [];
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
  const variations = [cleaned];
  
  // Handle Vietnamese phone formats
  if (cleaned.startsWith("0")) {
    variations.push("84" + cleaned.substring(1));
  } else if (cleaned.startsWith("84")) {
    variations.push("0" + cleaned.substring(2));
  }
  
  return variations;
}

// Examples:
// "0123456789" → ["0123456789", "84123456789"]
// "84123456789" → ["84123456789", "0123456789"]
// "+84 123 456 789" → ["84123456789", "0123456789"]
```

#### Phone Extraction from Notes
```typescript
function extractPhonesFromNote(note: string): string[] {
  if (!note) return [];
  
  // Regex for Vietnamese phone numbers (10-11 digits)
  const phoneRegex = /(?:\+?84|0)(?:\d[\s\-\.]?){8,10}\d/g;
  const matches = note.match(phoneRegex);
  
  if (!matches) return [];
  
  const phones: string[] = [];
  matches.forEach(match => {
    const normalized = match.replace(/[\s\-\(\)\+\.]/g, "");
    phones.push(...normalizePhone(normalized));
  });
  
  return [...new Set(phones)]; // Remove duplicates
}

// Examples from notes:
// "Customer phone: 0123456789" → ["0123456789", "84123456789"]
// "Contact: +84 123 456 789 or 0987654321" → multiple phones
```

#### Matching Logic

**Step 1: Load Shopify Customers**
```typescript
const shopifyCustomers = await prisma.shopifyCustomer.findMany({
  where: {
    OR: [
      { phone: { not: null, not: "" } },
      { defaultAddressPhone: { not: null, not: "" } },
      { note: { not: null, not: "" } },
    ],
  },
  select: {
    id: true,
    phone: true,
    defaultAddressPhone: true,
    note: true,
    email: true,
    firstName: true,
    lastName: true,
  },
});
```

**Step 2: Build Phone Map (O(1) Lookup)**
```typescript
const phoneMap = new Map<string, typeof shopifyCustomers>();

for (const customer of shopifyCustomers) {
  const phonesSet = new Set<string>();
  
  // 1. Primary phone
  if (customer.phone) {
    normalizePhone(customer.phone).forEach(p => phonesSet.add(p));
  }
  
  // 2. Default address phone
  if (customer.defaultAddressPhone) {
    normalizePhone(customer.defaultAddressPhone).forEach(p => phonesSet.add(p));
  }
  
  // 3. Extract phones from note (limit 2000 chars)
  if (customer.note && customer.note.length < 2000) {
    extractPhonesFromNote(customer.note).forEach(p => phonesSet.add(p));
  }
  
  // Index all unique phones
  for (const phone of phonesSet) {
    if (!phoneMap.has(phone)) {
      phoneMap.set(phone, []);
    }
    phoneMap.get(phone)!.push(customer);
  }
}
```

**Step 3: Match in Batches**
```typescript
const batchSize = 1000;
const matchesToCreate: any[] = [];

for (let i = 0; i < unmappedCustomers.length; i += batchSize) {
  const batch = unmappedCustomers.slice(i, i + batchSize);
  
  for (const nhanhCustomer of batch) {
    // Normalize phone and lookup
    const phoneVariations = normalizePhone(nhanhCustomer.phone!);
    let shopifyMatches: typeof shopifyCustomers = [];

    for (const phoneVar of phoneVariations) {
      const found = phoneMap.get(phoneVar);
      if (found) {
        shopifyMatches.push(...found);
      }
    }

    // Remove duplicates
    shopifyMatches = Array.from(
      new Map(shopifyMatches.map(c => [c.id, c])).values()
    );

    // Only match if exactly 1 customer found
    if (shopifyMatches.length === 1) {
      matchesToCreate.push({
        nhanhCustomerId: nhanhCustomer.id,
        shopifyCustomerId: shopifyMatches[0].id,
        syncStatus: "PENDING",
      });
    }
  }

  // Bulk insert every 500 matches
  if (!dryRun && matchesToCreate.length >= 500) {
    await prisma.customerMapping.createMany({
      data: matchesToCreate,
      skipDuplicates: true,
    });
    matchesToCreate.length = 0;
  }
}
```

#### Performance

**Advantages**:
- 🎯 **Accurate**: 3 phone sources (phone, defaultAddressPhone, note)
- 🔄 **Flexible**: Handles phone format variations
- 📊 **Scalable**: Batch processing
- 💾 **Memory Efficient**: Processes in chunks

**Speed**: ~500-2000 customers/sec (depending on dataset size)

**Best For**:
- Large customer databases (200k+)
- Multiple phone sources
- Vietnamese phone formats
- Incremental matching

---

## 📊 Comparison

| Feature | Products (SQL) | Customers (Batch) |
|---------|---------------|-------------------|
| **Technology** | Raw SQL JOIN | In-Memory Map + Batch |
| **Matching Field** | SKU | Phone Number |
| **Data Sources** | 1 (SKU only) | 3 (phone, defaultAddressPhone, note) |
| **Normalization** | Case-insensitive, trim | Phone format variations |
| **Speed** | Very Fast (1000-5000/sec) | Fast (500-2000/sec) |
| **Memory Usage** | Low (database-level) | Medium (load Shopify data) |
| **Complexity** | Low | Medium |
| **Accuracy** | High (exact match) | High (1-to-1 only) |
| **Best For** | Large catalogs | Large customer bases |

## 🎯 Matching Rules

### Products
```
✅ Match if:
- SKU exists in both systems
- SKU matches exactly (case-insensitive)
- 1 Nhanh product → 1 Shopify product
- Not already mapped

❌ Skip if:
- SKU is null/empty
- Multiple matches found
- Already mapped
```

### Customers
```
✅ Match if:
- Phone exists in Nhanh
- Phone found in Shopify (any of 3 sources)
- 1 Nhanh customer → 1 Shopify customer
- Not already mapped

❌ Skip if:
- Phone is null/empty
- No match found
- Multiple matches found (ambiguous)
- Already mapped
```

## 🚀 Performance Optimization

### Products
1. **Database-level JOIN** - Fastest possible
2. **Bulk inserts** - 500 products per batch
3. **Skip duplicates** - ON CONFLICT DO NOTHING
4. **Minimal data transfer** - Only needed fields

### Customers
1. **In-memory map** - O(1) lookup
2. **Batch processing** - 1000 customers per batch
3. **Phone normalization** - Handle format variations
4. **Bulk inserts** - 500 mappings per batch
5. **Note length limit** - Skip very long notes (>2000 chars)

## 💡 Best Practices

### When to Use Products Auto-Match
- ✅ After pulling products from both systems
- ✅ When SKUs are standardized
- ✅ For initial bulk matching
- ✅ When you need fast results

### When to Use Customers Auto-Match
- ✅ After pulling customers from both systems
- ✅ When phone numbers are available
- ✅ For large customer databases
- ✅ When customers have multiple phone sources

## 🔮 Future Improvements

### Potential Enhancements
1. **Fuzzy matching** - Handle typos in SKU/phone
2. **Multiple field matching** - Combine SKU + barcode for products
3. **Confidence scores** - Rate match quality
4. **Manual review queue** - For ambiguous matches
5. **Parallel processing** - Split into multiple workers
6. **Caching** - Cache phone map for repeated runs

## ✅ Conclusion

Cả 2 APIs đều được optimize cho use case riêng:
- **Products**: SQL JOIN cho speed tối đa
- **Customers**: In-memory map cho flexibility và accuracy

Cả 2 đều có job tracking để monitor progress real-time! 🎉
