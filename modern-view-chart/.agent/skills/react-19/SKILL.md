---
name: react-19
description: Hướng dẫn sử dụng các tính năng và tối ưu hóa cho React 19.
---

# React 19 Best Practices

Tài liệu này cung cấp các quy tắc và hướng dẫn để tận dụng tối đa sức mạnh của React 19 trong dự án.

## 1. Không sử dụng Memoization thủ công (Bắt buộc)
React 19 đi kèm với React Compiler, giúp tự động tối ưu hóa việc re-render.
- ✅ **NÊN**: Viết code logic trực tiếp trong component.
- ❌ **KHÔNG NÊN**: Sử dụng `useMemo` hoặc `useCallback` trừ khi thực sự cần thiết cho các dependency của useEffect hoặc các thư viện bên thứ ba yêu cầu reference ổn định.

```typescript
// ✅ Tốt: Để React tự lo
function PriceDisplay({ price }) {
  const formattedPrice = formatCurrency(price);
  return <div>{formattedPrice}</div>;
}

// ❌ Xấu: Tránh lạm dụng
const formattedPrice = useMemo(() => formatCurrency(price), [price]);
```

## 2. Imports (Bắt buộc)
- ✅ **NÊN**: Sử dụng Named imports cho các Hook.
  `import { useState, useEffect, useRef } from "react";`
- ❌ **KHÔNG NÊN**: Import toàn bộ React.
  `import React from "react";`

## 3. Server Components & Client Components
- **Mặc định là Server Component**: Chỉ thêm `"use client"` khi cần sử dụng Hook (`useState`, `useEffect`) hoặc Event Handlers.
- **Next.js 15+**: Tận dụng triệt để kiến trúc Server-first để giảm dung lượng bundle tải về Client.

## 4. Hook `use()` mới
- Sử dụng `use(Promise)` để đọc dữ liệu từ Promise trực tiếp trong render (thay cho useEffect + state).
- Sử dụng `use(Context)` để đọc context theo điều kiện (điều mà `useContext` không làm được).

## 5. Refs như là Props
Trong React 19, `ref` giờ đây chỉ là một prop thông thường.
- ✅ **NÊN**: Truyền `ref` trực tiếp như prop.
- ❌ **KHÔNG NÊN**: Sử dụng `forwardRef`.

```typescript
// ✅ React 19
function CustomInput({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}
```

## 6. Actions & useActionState
Sử dụng Actions để xử lý Form và cập nhật dữ liệu Server một cách mượt mà, tự động xử lý trạng thái `isPending`.

```typescript
const [state, action, isPending] = useActionState(updatePriceAction, null);
```
