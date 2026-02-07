---
name: viewx-chart-expert
description: Kỹ năng chuyên sâu về hệ thống biểu đồ ViewX sử dụng Lightweight Charts.
---

# ViewX Chart Expert

Tài liệu này tập trung vào các kỹ thuật và tiêu chuẩn riêng cho dự án `modern-view-chart`.

## 1. Kiến trúc Biểu đồ
- **Core Library**: Sử dụng `lightweight-charts`.
- **Đồng bộ hóa (Synchronization)**: Mọi sub-chart (như RSI, Volume) phải được đồng bộ hóa trục thời gian (Time Scale) với biểu đồ chính theo cơ chế một chiều (One-way sync).
- **Indicators**: Được đặt trong `src/features/chart/indicators/`. Mỗi indicator là một class hoặc module riêng biệt.

## 2. Xử lý Dữ liệu Real-time
- **Cập nhật RSI**: Khi có nến mới từ WebSocket, RSI phải được tính toán lại chỉ cho điểm cuối cùng hoặc nến hiện tại để tối ưu hiệu năng.
- **Timestamp**: Luôn đảm bảo định dạng `Time` (number hoặc string chuẩn) tương thích với Lightweight Charts để tránh lỗi "Cannot update oldest data".

## 3. Cấu trúc Thư mục
- `hooks/`: Chứa các logic khởi tạo (`use-chart-init`), dữ liệu (`use-chart-data`), và chỉ báo (`use-chart-indicators`).
- `components/`: Các thành phần UI bao quanh chart.

## 4. Lưu ý quan trọng
- Luôn kiểm tra tính tồn tại của các Series API trước khi gọi hàm (ví dụ: `rsiSeriesRef.current`).
- Đảm bảo các Price Scale của Indicators (như RSI 0-100) không bị lẫn lộn với Price Scale của giá.
- **Hiệu năng**: Luôn tuân thủ các quy tắc trong [performance-chart-expert](../../performance-chart-expert/SKILL.md) để đảm bảo biểu đồ mượt mà.
