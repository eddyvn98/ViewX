---
name: performance-chart-expert
description: Kỹ năng tối ưu hóa hiệu năng cao cho biểu đồ Trading (Lightweight Charts + React 19).
---

# Performance Chart Expert

Tài liệu này cung cấp các tiêu chuẩn và kỹ thuật để xử lý biểu đồ trading mượt mà, không lag, ngay cả khi có lượng dữ liệu lớn và cập nhật realtime liên tục.

## 1. Chiến lược cập nhật Real-time
- **Throttling Updates**: Khi nhận dữ liệu từ WebSocket (ví dụ: ticks), không nên cập nhật biểu đồ tại mọi tick nếu tần suất quá cao (> 100ms).
- **Cumulative Updates**: Gom các cập nhật nhỏ vào một lần gọi `update` duy nhất trong mỗi frame (RequestAnimationFrame).
- **Selective Rendering**: Chỉ cập nhật Series cần thiết. Ví dụ: Nếu chỉ giá thay đổi, đừng gọi `setData` cho toàn bộ RSI Series.

## 2. Tối ưu hóa React & Windowing
- **Windowing/Virtualization**: Sử dụng `react-window` hoặc `react-virtualized-auto-sizer` cho các danh sách lớn như Market List hoặc Trade History để giảm số lượng DOM nodes.
- **Memoization Chiến lược**: Mặc dù React 19 tự động memo, đối với các tính toán nặng (như Indicators phức tạp), vẫn nên dùng `useMemo` để đảm bảo không tính toán lại vô ích.
- **Selector Optimization**: Trong `useMarketStore` (Zustand), hãy chọn lọc field nhỏ nhất cần thiết:
  ```typescript
  const price = useMarketStore(state => state.tickers[symbol]?.price); // Tốt
  ```

## 3. Lightweight Charts Specific
- **Avoid setData for Real-time**: Dùng `series.update()` cho nến hiện tại thay vì `series.setData()` (vì `setData` vẽ lại toàn bộ series).
- **Price Scale Sync**: Tránh tính toán lại `visibleRange` quá liên tục khi không cần thiết.
- **Cleanup**: Luôn gọi `chart.removeSeries()` và `chart.remove()` trong useEffect cleanup để tránh rò rỉ bộ nhớ (Memory Leak).

## 4. State Management (React 19)
- **Transition API**: Sử dụng `startTransition` cho các cập nhật không ưu tiên (như đổi màu theme biểu đồ) để tránh chặn luồng UI chính.
- **Batching**: Tận dụng tính năng automatic batching của React để giảm số lần render.

## 5. Quy tắc cho Senior
- Không bao giờ để logic tính toán Indicator nặng chạy trực tiếp trong hàm render của Component.
- Luôn kiểm tra fps và độ trễ hover bằng Profiler khi thêm tính năng mới cho Chart.
- Đảm bảo các component Chart chỉ re-render khi dữ liệu liên quan thực sự thay đổi.

