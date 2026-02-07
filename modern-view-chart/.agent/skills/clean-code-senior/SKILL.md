---
name: clean-code-senior
description: Tiêu chuẩn viết code sạch (Clean Code) của Senior Engineer cho mọi dự án.
---

# Clean Code Senior Standards

Tài liệu này định nghĩa các tiêu chuẩn bắt buộc cho việc viết code, nhằm đảm bảo tính bảo trì cao, dễ đọc và thông minh.

## 1. Nguyên tắc cốt lõi
- **1 File 1 Chức năng**: Mỗi file chỉ đảm nhiệm một nhiệm vụ duy nhất và rõ ràng. Tránh tạo ra các "God Files".
- **Giới hạn độ dài**: Một file không được dài quá **200 dòng**. Nếu vượt quá, cần xem xét tách nhỏ thành các module/component con.
- **Viết code thông minh**: Sử dụng các pattern hiện đại (Hooks, Composition, Factory), ưu tiên giải pháp tối ưu.

## 2. Quy chuẩn Code (Bắt buộc)
- **Naming Convention**: 
  - **Hàm**: Sử dụng Động từ (ví dụ: `fetchUserData`, `calculateRSI`).
  - **Biến/Hằng**: Sử dụng Danh từ (ví dụ: `priceList`, `isChartReady`).
- **Named Imports**: Luôn sử dụng named imports cho React Hooks.
  `import { useState, useEffect } from "react";`
- **Early Returns**: Xử lý lỗi/ngoại lệ trước để tránh lồng ghép logic (nesting).
- **Tách biệt Logic và UI**: Đưa logic phức tạp vào custom hooks hoặc utility functions.

## 3. Giao tiếp & Quy trình
- Luôn giải thích các quyết định thiết kế quan trọng.
- Luôn tương tác và phản hồi bằng **tiếng Việt**.
- **Quy tắc 200 dòng**: AI phải kiểm tra độ dài file trước khi sửa. Nếu sắp vượt ngưỡng, chủ động đề xuất refactor.
- **Typescript**: Mọi component/function phải có kiểu dữ liệu rõ ràng.

