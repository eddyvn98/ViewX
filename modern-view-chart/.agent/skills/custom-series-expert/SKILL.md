---
description: Chuyên gia xây dựng Custom Series (Nến tùy chỉnh, Diamond Chart, Heavy Render) với Lightweight Charts API.
name: custom-series-expert
---

# Custom Series Expert

Hệ thống kiến thức chuyên sâu để xây dựng các loại biểu đồ nến tùy chỉnh (Custom Series) phức tạp, đẹp mắt và hiệu năng cao.

## 1. Kiến trúc Custom Series
Khác với Indicator (thường dùng `ISeriesPrimitive`), Custom Series thay thế hoàn toàn cách vẽ nến mặc định.
Cấu trúc chuẩn:
1.  **Data Interface**: Kế thừa `CustomData<Time>`.
    *   Bắt buộc: `time`, `open`, `high`, `low`, `close` (để tính toán scale giá tự động).
    *   Tùy chọn: `color`, `markerText`, v.v.
2.  **Series Class**: Implement `ICustomSeriesPaneView`.
    *   `renderer()`: Trả về instance của Renderer.
    *   `update(data, options)`: Cập nhật data cho Renderer.
    *   `priceValueBuilder(data)`: Trả về mảng `[high, low, close]` để chart tự tính toán scale.
3.  **Renderer Class**: Implement `ICustomSeriesPaneRenderer`.
    *   `draw(target, priceConverter)`: Nơi thực hiện vẽ Canvas.

## 2. Renderer & Performance Optimization
Vẽ Custom Series rất tốn kém tài nguyên (vẽ hàng nghìn nến). Cần tối ưu triệt để:

### A. Batch Rendering theo Màu (Quan trọng)
Thay vì loop qua từng nến và đổi `ctx.fillStyle` liên tục (gây tốn kém context switch):
1.  Gom nhóm (Group) các nến cùng màu vào một mảng/Map.
2.  Loop qua từng nhóm màu:
    *   `ctx.fillStyle = color;` (Chỉ set 1 lần).
    *   `ctx.beginPath();`
    *   Loop qua các nến trong nhóm đó -> `ctx.rect(...)` hoặc `ctx.moveTo(...)`.
    *   `ctx.fill();` (Vẽ 1 lần cho cả nhóm).

### B. Chỉ vẽ trong Visible Range
`PaneRendererCustomData` cung cấp `bars` (chỉ chứa các nến đang hiển thị trong Viewport).
**LUÔN LUÔN** chỉ loop qua `data.bars`, không bao giờ loop qua toàn bộ dataset gốc.

## 3. Pixel-Perfect Drawing (High DPI)
Canvas trên màn hình Retina/High DPI sẽ bị mờ nếu không xử lý tỷ lệ pixel.
*   **Tham số**: `horizontalPixelRatio`, `verticalPixelRatio`.
*   **Quy tắc**:
    *   Tọa độ X (Time): `Math.round(bar.x * horizontalPixelRatio)`
    *   Tọa độ Y (Price): `Math.round(priceConverter(price) * verticalPixelRatio)`
    *   Độ dày nét (LineWidth): `Math.max(1, width * verticalPixelRatio)`
    *   Font Size: `Math.round(fontSize * verticalPixelRatio)`

## 4. Visual Effects (Gradient & Shapes)
Để tạo nến đẹp (như Diamond, Glassmorphism):
1.  **Gradient Fill**: Dùng `ctx.createLinearGradient(0, high, 0, low)` để tạo độ sâu.
2.  **Faceting (Tạo khối)**:
    *   Vẽ nhiều lớp (Layers) đè lên nhau.
    *   Lớp 1: Fill nền (Gradient màu chính).
    *   Lớp 2: Spine (Sống lưng) - Gradient trắng/đen dọc.
    *   Lớp 3: Cross-beam (Thanh ngang) - Gradient ngang tại vị trí Close.
    *   Lớp 4: Flare/Sparkle - Radial Gradient tạo điểm sáng tại Close.
3.  **Sharp Edges**: Luôn dùng `Math.round()` cho tọa độ để tránh Anti-aliasing làm mờ cạnh (nhất là với nét mảnh 1px).

## 5. Custom Markers & Text
Custom Series Renderer có thể tự vẽ Marker/Text (thay vì dùng `ISeriesMarkersPluginApi`).
*   **Ưu điểm**: Đồng bộ hoàn hảo với logic vẽ nến, performance cao hơn.
*   **Cách làm**:
    *   Trong loop vẽ nến, kiểm tra `bar.originalData.markerText`.
    *   Vẽ text dùng `ctx.fillText()`.
    *   Lưu ý `ctx.save()` và `ctx.restore()` khi thay đổi global alpha hoặc shadow cho text.
