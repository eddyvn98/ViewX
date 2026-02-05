---
name: clean-code-senior
description: Tiêu chuẩn viết code sạch (Clean Code) của Senior Engineer cho mọi dự án.
---

# Clean Code Senior Standards

Tài liệu này định nghĩa các tiêu chuẩn bắt buộc cho việc viết code, nhằm đảm bảo tính bảo trì cao, dễ đọc và thông minh.

## 1. Nguyên tắc cốt lõi
- **1 File 1 Chức năng**: Mỗi file chỉ đảm nhiệm một nhiệm vụ duy nhất và rõ ràng. Tránh tạo ra các "God Files" chứa quá nhiều logic hỗn hợp.
- **Giới hạn độ dài**: Một file không được dài quá **200 dòng**. Nếu vượt quá, cần xem xét tách nhỏ thành các module/component con. (Có thể lệch nhẹ nếu thực sự cần thiết nhưng không khuyến khích).
- **Viết code thông minh**: Sử dụng các pattern hiện đại (Hooks, Composition, Factory, etc.), ưu tiên giải pháp tối ưu về hiệu năng và logic rõ ràng.

## 2. Cấu trúc và Trình bày
- **Clean Naming**: Tên biến, hàm phải mang tính mô tả cao, rõ nghĩa.
- **Early Returns**: Ưu tiên xử lý các trường hợp lỗi/ngoại lệ trước để giảm độ lồng ghép (nesting) của code.
- **Tách biệt Logic và UI**: Logic phức tạp nên được đưa vào custom hooks hoặc các utility functions riêng biệt.

## 3. Giao tiếp
- Luôn giải thích các quyết định thiết kế quan trọng.
- Luôn tương tác và phản hồi bằng **tiếng Việt**.

## 4. Quy trình làm việc của AI
1. Kiểm tra độ dài file hiện tại trước khi sửa đổi.
2. Nếu việc thêm code làm file vượt quá 200 dòng, chủ động lập kế hoạch refactor/tách file.
3. Đảm bảo mọi component/function đều có kiểu dữ liệu (Typescript) rõ ràng.
