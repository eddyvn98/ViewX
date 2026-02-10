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

## 4. Xử lý Tương tác Mobile (Critical)
- **Cơ chế Long-Press**: Trên thiết bị cảm ứng, sử dụng Long-press (nhấn giữ ~450ms) để mở các Menu chỉnh sửa thay vì Tap nhanh. Điều này giúp ngăn chặn hiện tượng "nhảy" do Ghost Clicks.
- **Triệt tiêu Ghost Clicks**: Luôn sử dụng `e.preventDefault()` và `e.stopPropagation()` trong các sự kiện Pointer/Touch. Kết hợp `touch-action: none` trong CSS để tắt hành vi mặc định của trình duyệt.
- **Chặn Context Menu**: Luôn chặn menu ngữ cảnh (`onContextMenu`) trên các phần tử Overlay để tránh Menu hệ thống chồng lên giao diện web.
- **Visual Sync**: Sử dụng `useLayoutEffect` khi đồng bộ vị trí các phần tử DOM (như Tag lệnh) theo di chuyển của biểu đồ để tránh hiện tượng flickering.

## 5. Logic Quản lý Lệnh (Order Logic)
- **Xóa độc lập**: Xóa SL/TP chỉ gửi `modify` với giá = 0, không được gọi `addPendingDeletion` (vì hàm này sẽ ẩn toàn bộ vạch lệnh của ticket đó).
- **Xóa Entry (= Xóa hết)**: Chỉ khi xóa vạch Entry chính mới gọi `addPendingDeletion` để ẩn toàn bộ ticket.
- **Session ID**: Khi mở Overlay chỉnh sửa, hãy cấp một `sessionId` (timestamp) để tránh các sự kiện `onBlur` cũ đóng nhầm bảng điều khiển mới.

## 6. Lưu ý quan trọng
- Luôn kiểm tra tính tồn tại của các Series API trước khi gọi hàm (ví dụ: `rsiSeriesRef.current`).
- Đảm bảo các Price Scale của Indicators (như RSI 0-100) không bị lẫn lộn với Price Scale của giá.
- **Hiệu năng**: Luôn tuân thủ các quy tắc trong [performance-chart-expert](../../performance-chart-expert/SKILL.md) để đảm bảo biểu đồ mượt mà.
