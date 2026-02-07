---
name: performance-chart-expert
description: Kỹ năng tối ưu hóa hiệu năng cao cho biểu đồ Trading (Lightweight Charts + React).
---

# Performance Chart Expert

Tài liệu này cung cấp các tiêu chuẩn và kỹ thuật để xử lý biểu đồ trading mượt mà, không lag, ngay cả khi có lượng dữ liệu lớn và cập nhật realtime liên tục.

## 1. Chiến lược cập nhật Real-time
- **Throttling Updates**: Khi nhận dữ liệu từ WebSocket (ví dụ: ticks), không nên cập nhật biểu đồ tại mọi tick nếu tần suất quá cao (> 100ms).
- **Cumulative Updates**: Gom các cập nhật nhỏ vào một lần gọi `update` duy nhất trong mỗi frame (RequestAnimationFrame).
- **Selective Rendering**: Chỉ cập nhật Series cần thiết. Ví dụ: Nếu chỉ giá thay đổi, đừng gọi `setData` cho toàn bộ RSI Series.

## 2. Tối ưu hóa React
- **Memoization**: Luôn dùng `useMemo` cho các tính toán dữ liệu chart (OHLC, Indicators) dựa trên `candleData`.
- **Selector Optimization**: Trong `useMarketStore` (Zustand), hãy chọn lọc field nhỏ nhất cần thiết:
  ```typescript
  const price = useMarketStore(state => state.tickers[symbol]?.price); // Tốt
  const tickers = useMarketStore(state => state.tickers); // Kém (re-render khi bất kỳ ticker nào đổi)
  ```
- **Custom Event Bus**: Với các thành phần cực kỳ realtime (như Cursor Price), cân nhắc dùng Refs và thao tác DOM trực tiếp thay vì thông qua React State để tránh lag hover.

## 3. Lightweight Charts Specific
- **Avoid setData for Real-time**: Dùng `series.update()` cho nến hiện tại thay vì `series.setData()` (vì `setData` vẽ lại toàn bộ series).
- **Price Scale Sync**: Tránh tính toán lại `visibleRange` quá liên tục khi không cần thiết.
- **Cleanup**: Luôn gọi `chart.removeSeries()` và `chart.remove()` trong useEffect cleanup để tránh rò rỉ bộ nhớ (Memory Leak).

## 4. Kiểm soát độ phức tạp
- Giới hạn số lượng nến hiển thị nếu có dấu hiệu lag (ví dụ: chỉ render 1000 nến gần nhất nếu không cần xem quá khứ).
- Indicators phức tạp nên được tính toán tại phía Worker hoặc Backend nếu có thể.

## 5. Quy tắc cho Senior
- Không bao giờ để logic tính toán Indicator nặng chạy trực tiếp trong hàm render của Component.
- Luôn kiểm tra fps và độ trễ hover bằng Profiler khi thêm tính năng mới cho Chart.
