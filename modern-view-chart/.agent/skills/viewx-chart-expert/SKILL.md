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
## 7. Kiến trúc Mobile Bottom Navigation (Advanced)

Hệ thống thanh điều hướng dưới cùng (Bottom Bar) trên mobile yêu cầu sự ổn định cực cao để tránh hiện tượng tràn layout (overflow) và giật lag cảm ứng.

### 7.1. Chống Tràn Layout (Layout Stability)
- **Cấu trúc Flex Column**: Luôn sử dụng `flex flex-col h-screen` hoặc `h-[100dvh]` cho layout tổng thể.
- **Fixed Height**: Bottom Bar và các thanh công cụ (Symbol/Drawing) phải có chiều cao cố định (ví dụ: `48px`) để đảm bảo các thành phần bên trên (Chart) được tính toán diện tích chính xác.
- **Absolute Content**: Các chế độ hiển thị khác nhau (Symbol carousel, Drawing toolbar) nên được `absolute inset-0` và chuyển đổi bằng `opacity/scale` thay vì mount/unmount để tránh giật giao diện.

### 7.2. Cơ chế Bánh xe Dọc (Vertical Wheel Logic)
- **Atomic State Swapping**: Để tránh hiện tượng "nháy" (flicker) khi đổi mode:
    1. Chạy hiệu ứng animation kéo bánh xe (`translateY`).
    2. Đợi animation hoàn tất (ví dụ: 300ms).
    3. Cập nhật state `mode`.
    4. Cùng lúc đó, reset `translateY` về 0 ngay lập tức (`transition-none`).
- **Direction Locking**: Nếu component con có cuộn ngang (Carousel), component cha phải có logic khóa hướng:
    - Nếu `deltaX > deltaY` (vuốt ngang): Khóa hướng ngang và bỏ qua các sự kiện cuộn dọc của bánh xe cha.

### 7.3. Cuộn Vô Hạn (Infinite Carousel Pattern)
- **Triple-List Strategy**: Nhân ba danh sách dữ liệu (Đầu - Giữa - Cuối).
- **Invisible Jump**:
    - Monitor sự kiện `scrollLeft`.
    - Khi chạm đến biên (80% của Set 1 hoặc 20% của Set 3), sử dụng `scrollTo` với `behavior: 'auto'` để nhảy về vị trí tương ứng ở Set giữa.
- **Initial Sync**: Luôn căn giữa item hiện tại vào Set ở giữa khi khởi tạo.

### 7.4. Điều hướng Thông minh (Intelligent Navigation)
- Thay vì sử dụng nút "Biểu đồ" dư thừa, hãy thiết lập logic tự động switch tab. Ví dụ: Khi người dùng vuốt bánh xe về mode "Symbol" hoặc "Drawing" từ bất kỳ tab nào khác, hệ thống sẽ tự động gọi `onTabChange('chart')`.

## 8. Vẽ Lệnh và Vị thế (Order Rendering)

Việc hiển thị lệnh trên biểu đồ sử dụng kết hợp giữa `PriceLines` của thư viện và Overlay DOM của React để đạt hiệu năng cao nhất.

### 8.1. Quản lý Price Lines (`useChartOrders`)
- **Tách biệt Logic**: Luôn tách biệt phần tạo/xóa Line (chạy khi danh sách lệnh thay đổi) và phần cập nhật giá Line (chạy liên tục khi Drag).
- **PriceLine Reference**: Lưu trữ các đối tượng `IPriceLine` trong một `useRef` map theo ticket ID. Khi lệnh bị xóa khỏi store, phải gọi `series.removePriceLine` tương ứng.
- **Fast Drag Sync**: Sử dụng `useMarketStore.subscribe` để lắng nghe state `draggingPosition` và gọi `applyOptions({ price: ... })` trực tiếp lên đối tượng Line thay vì re-render toàn bộ component.

### 8.2. Tag Điều khiển (`OrderLineTags`)
- **Hiệu năng DOM**: Các nhãn lệnh (Tag) không nên được render hoàn toàn bằng React component nếu số lượng lớn. Sử dụng `document.createElement` và cập nhật trực tiếp qua `HTMLElement` (`tag-renderer.ts`) để tránh React reconciliation overhead khi zoom/scroll.
- **Vị trí Y**: Luôn sử dụng `series.priceToCoordinate(price)` để tính toán vị trí pixel dọc. Cập nhật vị trí bằng `transform: translateY()` để tận dụng tăng tốc phần cứng (GPU).

## 9. Tương tác Web và Lightweight Charts

Sự phối hợp giữa Canvas (thư viện) và DOM (web) cần tuân thủ các nguyên tắc sau:

### 9.1. Đồng bộ hóa Overlay
- **Subscribing Events**: Sử dụng `timeScale.subscribeVisibleLogicalRangeChange` và `subscribeCrosshairMove` để kích hoạt hàm sync vị trí của các phần tử DOM overlay.
- **Throttling với RAF**: Luôn bọc hàm sync trong `requestAnimationFrame` để đảm bảo vị trí Overlay khớp chính xác với Canvas mà không bị trễ (lag) hoặc giật (jitter).
- **useLayoutEffect**: Sử dụng `useLayoutEffect` thay vì `useEffect` cho các logic đồng bộ vị trí để tránh hiện tượng phần tử DOM bị "nhảy" sau khi Chart đã vẽ xong.

### 9.2. Tương tác Kéo - Thả (Drag & Drop)
- **Tắt hành vi mặc định**: Khi bắt đầu kéo một phần tử overlay (ví dụ: SL/TP), phải gọi `e.preventDefault()` để tránh xung đột với sự kiện scroll của Chart.
- **Coordinate Conversion**: Khi di chuyển chuột trên Chart, sử dụng `series.coordinateToPrice(y)` để chuyển đổi tọa độ pixel ngược lại thành mức giá thực tế trước khi cập nhật vào Store.
