# Next.js 16 Dynamic Params Fix

## ⚠️ Vấn đề

Lỗi khi chạy với Next.js 16:

```
Error [PrismaClientValidationError]:
Invalid `prisma.customerMapping.update()` invocation in
...
Argument `where` of type CustomerMappingWhereUniqueInput needs at least one of `id` or `nhanhCustomerId` arguments.
```

## 🔍 Nguyên nhân

**Next.js 16 Breaking Change**: Dynamic route params giờ là **Promise** thay vì object trực tiếp.

### Trước (Next.js 15)
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id; // ✅ Hoạt động
}
```

### Sau (Next.js 16)
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // ✅ Phải await
}
```

## ✅ Files đã sửa

### 1. `/api/sync/mapping/[id]/route.ts`

**GET method**:
```typescript
// Before
{ params }: { params: { id: string } }
const mapping = await prisma.customerMapping.findUnique({
  where: { id: params.id },
});

// After
{ params }: { params: Promise<{ id: string }> }
const { id } = await params;
const mapping = await prisma.customerMapping.findUnique({
  where: { id },
});
```

**PATCH method**:
```typescript
// Before
{ params }: { params: { id: string } }
const mapping = await prisma.customerMapping.update({
  where: { id: params.id },
});

// After
{ params }: { params: Promise<{ id: string }> }
const { id } = await params;
const mapping = await prisma.customerMapping.update({
  where: { id },
});
```

### 2. `/api/nhanh/customer/[id]/route.ts`

```typescript
// Before
{ params }: { params: { id: string } }
const customer = await nhanhAPI.getCustomerById(params.id);

// After
{ params }: { params: Promise<{ id: string }> }
const { id } = await params;
const customer = await nhanhAPI.getCustomerById(id);
```

### 3. `/api/shopify/customer/[id]/route.ts`

```typescript
// Before
{ params }: { params: { id: string } }
const customer = await shopifyAPI.getCustomerById(params.id);

// After
{ params }: { params: Promise<{ id: string }> }
const { id } = await params;
const customer = await shopifyAPI.getCustomerById(id);
```

## 📝 Pattern để nhớ

Với Next.js 16, **TẤT CẢ** dynamic route params đều là Promise:

```typescript
// ❌ SAI
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id; // Lỗi!
}

// ✅ ĐÚNG
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // OK!
}
```

## 🔍 Cách tìm lỗi tương tự

Search trong project:
```bash
# Tìm các route có params nhưng chưa await
grep -r "params: { params: {" src/app/api
```

Hoặc dùng regex:
```
params:\s*{\s*params:\s*{[^}]+}\s*}
```

## 📚 Tài liệu

- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading/version-16)
- [Dynamic Routes Breaking Changes](https://nextjs.org/docs/app/api-reference/file-conventions/route#params-optional)

## ✅ Kết quả

- ✅ Tất cả dynamic routes đã được fix
- ✅ Prisma queries hoạt động bình thường
- ✅ Không còn validation errors
- ✅ API endpoints hoạt động đúng

## 🎉 Hoàn thành

Tất cả lỗi liên quan đến dynamic params đã được fix! 

**Lưu ý**: Nếu thêm route mới với dynamic params, nhớ dùng `Promise<{ id: string }>` và `await params`.
