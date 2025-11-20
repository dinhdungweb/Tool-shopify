# Numbered Pagination Feature ✅

## Tóm tắt
Đã nâng cấp pagination từ Previous/Next đơn giản sang numbered pagination với các số trang.

## Các thay đổi

### 1. Helper Function
Thêm `getPageNumbers()` function để generate danh sách số trang hiển thị:
- Hiển thị tối đa 7 page buttons
- Luôn hiển thị trang đầu và trang cuối
- Hiển thị "..." khi có nhiều trang
- Hiển thị các trang xung quanh trang hiện tại

### 2. UI Improvements
- ✅ **Page Numbers**: Hiển thị các số trang có thể click
- ✅ **Active State**: Trang hiện tại được highlight màu brand
- ✅ **Ellipsis**: Hiển thị "..." khi có nhiều trang
- ✅ **Icons**: Thêm arrow icons cho Previous/Next
- ✅ **Better Info**: Hiển thị "Showing X to Y of Z customers"
- ✅ **Responsive**: Mobile-friendly với fallback
- ✅ **Disabled State**: Disable buttons khi loading

### 3. Logic
```typescript
// Example với 52 trang, đang ở trang 25:
[1] [...] [24] [25] [26] [...] [52]

// Ở trang 1:
[1] [2] [3] [...] [52]

// Ở trang 52:
[1] [...] [50] [51] [52]

// Ít hơn 7 trang:
[1] [2] [3] [4] [5]
```

## UI Design

### Desktop View
```
┌────────────────────────────────────────────────────────────────┐
│ Showing 1 to 50 of 2578 customers                              │
│                                                                 │
│ [← Previous] [1] [2] [3] [...] [52] [Next →]                  │
└────────────────────────────────────────────────────────────────┘
```

### Mobile View
```
┌────────────────────────────────────────────────────────────────┐
│ Showing 1 to 50 of 2578 customers                              │
│                                                                 │
│ [← Previous] Page 1 of 52 [Next →]                            │
└────────────────────────────────────────────────────────────────┘
```

## Features

### 1. Smart Page Display
- Hiển thị tối đa 7 page buttons để không bị quá dài
- Luôn hiển thị trang đầu (1) và trang cuối
- Hiển thị 1 trang trước và sau trang hiện tại
- Sử dụng "..." để thay thế các trang bị ẩn

### 2. Visual Feedback
- **Active page**: Background brand-500, text white
- **Inactive pages**: Border gray, background white
- **Hover state**: Background gray-50
- **Disabled state**: Opacity 50%, cursor not-allowed

### 3. Responsive Design
- **Desktop**: Hiển thị đầy đủ page numbers
- **Mobile**: Chỉ hiển thị "Page X of Y" để tiết kiệm không gian
- **Tablet**: Tự động adapt theo screen size

### 4. Accessibility
- Buttons có proper disabled states
- Clear visual indicators
- Keyboard navigation friendly
- Screen reader friendly

## Code Structure

```typescript
// Helper function
function getPageNumbers() {
  const pages: (number | string)[] = [];
  const maxVisible = 7;
  
  if (totalPages <= maxVisible) {
    // Show all pages
  } else {
    // Smart pagination with ellipsis
  }
  
  return pages;
}

// Render
{getPageNumbers().map((pageNum, index) => {
  if (pageNum === "...") {
    return <span>...</span>;
  }
  return <button onClick={() => setPage(pageNum)}>{pageNum}</button>;
})}
```

## Examples

### Example 1: Total 2578 customers, 50 per page = 52 pages

**Page 1:**
```
[1] [2] [3] [...] [52]
```

**Page 25:**
```
[1] [...] [24] [25] [26] [...] [52]
```

**Page 52:**
```
[1] [...] [50] [51] [52]
```

### Example 2: Total 150 customers, 50 per page = 3 pages

**Any page:**
```
[1] [2] [3]
```

### Example 3: Filtered to 50 customers = 1 page

**Page 1:**
```
[1]
```

## Benefits

1. **Better UX**: Users can jump to any page directly
2. **Visual clarity**: Easy to see current page and total pages
3. **Quick navigation**: No need to click Next multiple times
4. **Professional look**: Modern pagination design
5. **Mobile friendly**: Adapts to small screens

## Testing

### Manual Tests
- ✅ Click page numbers to navigate
- ✅ Previous/Next buttons work
- ✅ Active page is highlighted
- ✅ Ellipsis appears correctly
- ✅ First and last pages always visible
- ✅ Disabled states work
- ✅ Mobile view shows simplified version
- ✅ Works with filters and search

### Edge Cases
- ✅ 1 page total: Shows only [1]
- ✅ 2-7 pages: Shows all pages
- ✅ 8+ pages: Shows smart pagination with ellipsis
- ✅ Loading state: All buttons disabled
- ✅ Empty results: Pagination hidden

## Browser Compatibility
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

## Performance
- No performance impact
- Efficient re-rendering
- Minimal DOM updates
