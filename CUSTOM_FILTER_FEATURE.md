# 🎨 Custom Filter Feature - Mở rộng Shopify Pull

## ✨ **Tính năng mới**

Thêm **Custom Filter Input** và **Saved Filters** cho phép user:
1. Nhập bất kỳ Shopify query nào họ muốn
2. Lưu các filters thường dùng
3. Quản lý saved filters (delete)
4. Quick access đến saved filters

---

## 🎯 **Features**

### **1. Custom Filter Modal**

Modal đẹp với:
- ✅ Input field để nhập custom query
- ✅ Common filters reference (cheat sheet)
- ✅ Save filter button
- ✅ Pull customers button
- ✅ Keyboard support (Enter to submit)

### **2. Saved Filters**

- ✅ Lưu filters vào localStorage
- ✅ Hiển thị trong dropdown
- ✅ Quick access (1 click)
- ✅ Delete button cho mỗi filter
- ✅ Persist across sessions

### **3. Enhanced Dropdown**

Dropdown structure:
```
┌─────────────────────────────────────┐
│ Pull Shopify Customers         ▼   │
├─────────────────────────────────────┤
│ 👥 All Customers                    │
│ 🔐 Customers with Accounts          │
│ 🛍️  Customers with Orders           │
│ 📧 Customers with Email             │
├─────────────────────────────────────┤
│ Saved Filters                       │
│ 📌 state:ENABLED AND tag:VIP    ❌  │
│ 📌 orders_count:>10              ❌  │
├─────────────────────────────────────┤
│ ➕ Custom Filter                     │
└─────────────────────────────────────┘
```

---

## 🔧 **Implementation**

### **1. State Management**

```typescript
const [customFilterModalOpen, setCustomFilterModalOpen] = useState(false);
const [customFilterInput, setCustomFilterInput] = useState("");
const [savedFilters, setSavedFilters] = useState<string[]>([]);
```

### **2. Load Saved Filters**

```typescript
useEffect(() => {
  const saved = localStorage.getItem("shopify_pull_filters");
  if (saved) {
    setSavedFilters(JSON.parse(saved));
  }
}, []);
```

### **3. Save/Delete Filters**

```typescript
function handleSaveFilter(filter: string) {
  const updated = [...new Set([...savedFilters, filter.trim()])];
  setSavedFilters(updated);
  localStorage.setItem("shopify_pull_filters", JSON.stringify(updated));
}

function handleDeleteFilter(filter: string) {
  const updated = savedFilters.filter(f => f !== filter);
  setSavedFilters(updated);
  localStorage.setItem("shopify_pull_filters", JSON.stringify(updated));
}
```

### **4. Custom Filter Modal**

```tsx
<Modal>
  <Input 
    value={customFilterInput}
    onChange={(e) => setCustomFilterInput(e.target.value)}
    placeholder="e.g. state:ENABLED AND orders_count:>5"
    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
  />
  
  <CheatSheet>
    • state:ENABLED - Customers with accounts
    • orders_count:>0 - Has at least 1 order
    • email:* - Has email address
    ...
  </CheatSheet>
  
  <Actions>
    <SaveButton />
    <CancelButton />
    <PullButton />
  </Actions>
</Modal>
```

---

## 🎨 **UI/UX Features**

### **1. Custom Filter Modal**

**Design:**
- Clean, modern modal
- Large input field
- Helpful cheat sheet
- Clear action buttons

**Interactions:**
- Click "Custom Filter" → Open modal
- Type query → See examples
- Press Enter → Submit
- Click "Save Filter" → Save to list
- Click "Pull Customers" → Start pull

### **2. Saved Filters in Dropdown**

**Design:**
- Separate section "Saved Filters"
- Bookmark icon for each filter
- Monospace font for queries
- Delete button (X) on hover

**Interactions:**
- Click filter → Pull with that filter
- Click X → Delete filter
- Hover → Show delete button

### **3. Cheat Sheet**

**Content:**
```
Common Filters:
• state:ENABLED - Customers with accounts
• orders_count:>0 - Has at least 1 order
• email:* - Has email address
• phone:* - Has phone number
• tag:VIP - Has "VIP" tag
• created_at:>2024-01-01 - Created after date

Combine with AND / OR
```

---

## 📖 **User Workflows**

### **Workflow 1: Create Custom Filter**

1. Click "Pull Shopify Customers" dropdown
2. Click "Custom Filter"
3. Modal opens
4. Type query: `state:ENABLED AND orders_count:>10`
5. Click "Save Filter" (optional)
6. Click "Pull Customers"
7. Confirm → Pull starts

### **Workflow 2: Use Saved Filter**

1. Click "Pull Shopify Customers" dropdown
2. See "Saved Filters" section
3. Click saved filter
4. Confirm → Pull starts

### **Workflow 3: Manage Saved Filters**

1. Click "Pull Shopify Customers" dropdown
2. See saved filters
3. Hover over filter → X button appears
4. Click X → Filter deleted
5. Dropdown updates

---

## 💡 **Example Use Cases**

### **1. VIP Customers with High Orders**

```
Filter: state:ENABLED AND orders_count:>10 AND tag:VIP
Save as: "VIP High Value"
Use: Weekly sync of VIP customers
```

### **2. New Customers This Month**

```
Filter: created_at:>2024-11-01
Save as: "November New"
Use: Monthly new customer analysis
```

### **3. Active Gmail Users**

```
Filter: email:*@gmail.com AND orders_count:>0
Save as: "Active Gmail"
Use: Email marketing campaigns
```

### **4. Customers Needing Follow-up**

```
Filter: orders_count:1 AND created_at:>2024-10-01
Save as: "First Order Recent"
Use: Follow-up campaigns
```

### **5. High-Value Customers**

```
Filter: orders_count:>20 AND state:ENABLED
Save as: "High Value"
Use: Loyalty program
```

---

## 🔒 **Data Persistence**

### **localStorage Structure:**

```json
{
  "shopify_pull_filters": [
    "state:ENABLED AND orders_count:>10",
    "email:*@gmail.com",
    "tag:VIP",
    "created_at:>2024-11-01"
  ]
}
```

**Benefits:**
- ✅ Persist across sessions
- ✅ No server storage needed
- ✅ Fast access
- ✅ User-specific

---

## 📊 **Performance**

### **localStorage:**
- Read: < 1ms
- Write: < 1ms
- Size limit: 5-10MB (plenty for filters)

### **UI:**
- Modal open: Instant
- Filter save: Instant
- Dropdown update: Instant

---

## 🎯 **Benefits**

### **For Users:**
- ✅ **Flexibility:** Any Shopify query
- ✅ **Convenience:** Save favorites
- ✅ **Speed:** Quick access
- ✅ **Learning:** Cheat sheet included

### **For Business:**
- ✅ **Targeted pulls:** Only relevant data
- ✅ **Faster syncs:** Fewer customers
- ✅ **Better insights:** Specific segments
- ✅ **Cost savings:** Less data transfer

---

## 🔮 **Future Enhancements**

### **1. Filter Templates**

Pre-defined templates:
- "Marketing Ready" (email + phone)
- "High Value" (orders > 10)
- "New This Month"
- "VIP Segment"

### **2. Filter Analytics**

Show before pull:
- Estimated customer count
- Estimated time
- Last pull date
- Success rate

### **3. Filter Sharing**

- Export filters
- Import filters
- Share with team
- Filter library

### **4. Advanced Editor**

- Syntax highlighting
- Auto-complete
- Validation
- Query builder UI

### **5. Filter History**

- Track filter usage
- Most used filters
- Recent filters
- Filter performance

---

## 📝 **Files Changed**

1. **src/components/customers-sync/CustomerSyncTable.tsx**
   - Add state for custom filter and saved filters
   - Add functions to save/delete filters
   - Add Custom Filter Modal
   - Add Saved Filters section in dropdown
   - Load/save to localStorage

---

## 🎉 **Kết luận**

**Đã mở rộng Shopify Pull với Custom Filter Feature!**

**New Features:**
- ✅ Custom filter input modal
- ✅ Saved filters management
- ✅ Cheat sheet for common queries
- ✅ localStorage persistence
- ✅ Beautiful UI/UX

**Benefits:**
- ✅ **Unlimited flexibility** - Any Shopify query
- ✅ **Save favorites** - Quick access
- ✅ **Easy to use** - Helpful examples
- ✅ **Fast** - Instant save/load

**User Experience:**
- 🎨 Beautiful modal design
- ⌨️ Keyboard shortcuts (Enter)
- 📌 Saved filters with delete
- 📖 Helpful cheat sheet
- ✨ Smooth interactions

---

**🎊 Feature complete và ready to use! 🎊**
