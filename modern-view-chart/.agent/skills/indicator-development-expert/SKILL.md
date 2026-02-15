---
description: Chuyên gia phát triển Indicator tùy chỉnh cho Lightweight Charts (Market Structure, Trend Lines, Auto-Break logic)
name: indicator-development-expert
---

# Indicator Development Expert

Hệ thống kiến thức và best practices khi phát triển các Indicator nâng cao (Custom Primitives, Market Structure, Auto-Drawing Tools) trên nền tảng Lightweight Charts.

## 1. Nguyên Tắc Cốt Lõi: Coordinate Spaces (Quan Trọng Nhất)
Khi vẽ các đối tượng hình học (Trend Line, Ray, Box) tùy chỉnh:
- **KHÔNG BAO GIỜ** trộn lẫn tọa độ logic (Time, Price) với tọa độ vật lý (Pixel).
- **Luôn luôn** chuyển đổi sang **Bitmap Coordinate Space** trước khi thực hiện bất kỳ phép tính hình học nào (tính slope, góc, điểm cắt).

### Quy trình chuẩn:
1.  **Lấy tọa độ:**
    ```typescript
    const x1 = timeScale.timeToCoordinate(p1.time);
    const y1 = series.priceToCoordinate(p1.price);
    ```
2.  **Chuyển sang Pixel vật lý (High DPI):**
    ```typescript
    const phyX1 = x1 * horizontalPixelRatio;
    const phyY1 = y1 * verticalPixelRatio;
    ```
3.  **Tính toán hình học (Slope, Extension):**
    ```typescript
    const slope = (phyY2 - phyY1) / (phyX2 - phyX1);
    const yFinal = phyY2 + slope * (params.width - phyX2); // Tính điểm cuối trên màn hình
    ```
4.  **Vẽ:**
    ```typescript
    ctx.moveTo(phyX1, phyY1);
    ctx.lineTo(params.width, yFinal); // Vẽ đến tận cùng bên phải màn hình
    ```
**Lý do:** Khi người dùng zoom/pan, tọa độ logic thay đổi phi tuyến tính. Nếu tính toán dựa trên logical `time` index, đường vẽ sẽ bị "trôi" hoặc "xoay" sai lệch khi chart scale thay đổi.

## 2. Market Structure & Swing Points
Để đảm bảo tính nhất quán giữa các Indicator liên quan (ví dụ: Label đỉnh đáy và Trend Line nối đỉnh đáy):
- **Luôn đồng bộ tham số `depth`:**
    - Nếu Market Structure Label dùng `depth = 7`, thì Trend Line **phải** dùng `depth = 7`.
    - Lệch tham số sẽ dẫn đến việc Trend Line nối vào "hư không" hoặc bỏ qua các đỉnh dáy mà user nhìn thấy.
- **Locality (Tính cục bộ):**
    - Ưu tiên nối các điểm **gần nhất** (Recent Highs/Lows).
    - Tránh scan ngược quá xa (ví dụ > 20 nến) trừ khi đang vẽ các đường Support/Resistance dài hạn (Major Structure).
    - Với Trend Line ngắn hạn (Minor Structure), chỉ nên nối 2-3 điểm swing gần nhất.

## 3. Auto-Break Detection (Tự động ẩn khi gãy)
Để giữ chart sạch sẽ, các đường Trend Line/Support nên tự động ẩn đi khi giá đã phá vỡ nó.
- **Logic kiểm tra:**
    - Sau khi xác định được đường Line (qua P1, P2), cần duyệt qua **tất cả** các nến phát sinh sau P2.
    - Nếu có bất kỳ nến nào vi phạm logic, đánh dấu Line là `Invalid`.
- **Price Type:**
    - **Nên dùng Close Price:** `if (candle.close > resistanceLine)` -> Gãy.
    - **Tránh dùng High/Low:** Râu nến (Wick) thường xuyên quét qua ("false break") rồi rút chân. Dùng High/Low sẽ khiến Line chớp tắt liên tục, gây nhiễu.
    - **Ngoại lệ:** Với các vùng Supply/Demand Zone quan trọng, có thể dùng High/Low nhưng cần thêm vùng đệm (buffer/zone) thay vì 1 đường line mỏng.

## 4. Performance Optimization
- **Tính toán trước (Pre-calculation):**
    - Logic tìm điểm (Swing Points), tìm Line, check Break nên được thực hiện ở lớp **Logic/Data**, không phải trong vòng lặp `draw()` của Renderer.
    - Renderer chỉ nên nhận danh sách `lines` đã được validate sạch sẽ và vẽ chúng.
- **Z-Order:**
    - Luôn đặt Z-Order phù hợp. Trend Line thường nên nằm **dưới** nến (`zOrder: 'bottom'`) hoặc ngang hàng, không nên che mất nến giá.

## 5. Visual Feedback
- **Dashed/Dotted Lines:** Dùng cho các đường "dự báo" hoặc đường kéo dài (Ray).
- **Solid Lines:** Dùng cho đoạn nối thực tế giữa 2 điểm đã đóng nến.
- **Màu sắc:**
    - Resistance (Nối đỉnh): Đỏ/Cam.
    - Support (Nối đáy): Xanh lá/Xanh dương.
    - Dùng Alpha (độ trong suốt) thấp (0.5 - 0.7) để không gây rối mắt khi đè lên nến.
