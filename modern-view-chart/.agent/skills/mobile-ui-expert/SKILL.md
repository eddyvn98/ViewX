---
description: Chuyên gia thiết kế UI/UX cho Mobile Web App (Gesture Navigation, Infinite Scroll, Haptics, Apple-style animations).
name: mobile-ui-expert
---

# Mobile UI Expert

Hệ thống các kỹ thuật nâng cao để xây dựng giao diện Mobile Web App mượt mà, tự nhiên như Native App (đặc biệt là phong cách iOS).

## 1. Gesture-Driven Navigation (Điều hướng bằng cử chỉ)
Thay vì chỉ bấm nút, cho phép người dùng vuốt (swipe) để chuyển đổi chế độ.
### Kỹ thuật:
- **Touch Handlers**:
    - `onTouchStart`: Ghi lại `startY`, `startX`.
    - `onTouchMove`: Tính `deltaY`. Kỹ thuật **Direction Locking**:
        - Nếu `deltaX > deltaY` -> Lock Horizontal (không cho vuốt dọc).
        - Nếu `deltaY > deltaX` -> Lock Vertical (cho phép vuốt đổi mode).
    - `onTouchEnd`: Tính toán quán tính hoặc snap về vị trí gần nhất.
- **Elastic Scrolling (Hiệu ứng dây thun)**:
    - Dùng `transform: translateY(px)` để di chuyển UI theo ngón tay theo tỉ lệ 1:1.
    - Khi thả tay: Dùng CSS transition (`transform 300ms ease-out`) để snap về vị trí đích.

## 2. Infinite Scroll Toolbar (Thanh công cụ vô tận)
Tạo cảm giác danh sách công cụ dài vô tận, lặp lại vòng tròn.
### Kỹ thuật:
- **Data Structure**: Nhân bản mảng dữ liệu lên 3 lần: `[...items, ...items, ...items]`.
- **Silent Jump (Nhảy âm thầm)**:
    - Lắng nghe sự kiện `scroll`.
    - Khi scroll đến gần đầu (Set 1) -> Nhảy ngay lập tức về giữa (Set 2).
    - Khi scroll đến gần cuối (Set 3) -> Nhảy ngay lập tức về giữa (Set 2).
    - Việc nhảy này không có animation nên user không nhận ra.
- **Center Focus**:
    - Tính toán khoảng cách từ mỗi item đến tâm màn hình (`distance`).
    - Áp dụng Scale/Opacity dựa trên `distance`: Item ở giữa to nhất, rõ nhất.
    - Công thức: `scale = 1.25 - (distance / 120 * 0.25)`.

## 3. Visual & Haptic Feedback (Phản hồi xúc giác)
Tạo cảm giác "thật" khi tương tác.
- **Haptics**: Gọi `window.navigator.vibrate(10)` (rung nhẹ 10ms) khi:
    - Snap thành công vào một mode mới.
    - Chọn một công cụ.
    - Kéo quá giới hạn (limit).
- **Backdrop Blur**: Luôn dùng `backdrop-blur-xl` hoặc `2xl` cho các thành phần trôi nổi (floating) để tạo chiều sâu (Depth).
- **Safe Area**: Luôn thêm class `pb-safe` (padding-bottom safe area) để tránh bị cấn vào thanh Home ảo của iPhone.

## 4. Atomic Animation State
Khi thực hiện các animation phức tạp liên quan đến State React:
1.  Bắt đầu Animation (CSS Transition).
2.  Chờ Animation kết thúc (`setTimeout`).
3.  **Atomic Swap**:
    *   Cập nhật React State mới (ví dụ: `setMode`).
    *   Tắt Transition (`transition: none`).
    *   Reset vị trí transform về 0 ngay lập tức.
    *   Đảm bảo UI không bị giật (flicker) giữa các frame.

## 5. Performance Tips
- **Will-Change**: Thêm `will-change-transform` cho các phần tử vuốt/kéo.
- **Passive Listeners**: Với các sự kiện cuộn/touch không chặn (non-blocking), trình duyệt thường tự tối ưu, nhưng cần chú ý không tính toán quá nặng trong `onTouchMove`.
- **Memoization**: Dùng `React.memo` cho các icon/item trong danh sách dài để tránh re-render không cần thiết khi parent scroll.

## 6. Vertical Mode Stacking (Mobile Bottom Nav)
Mô hình "Bottom Bar" không chỉ là các tab ngang, mà là một ngăn xếp dọc các chế độ (Modes).
### Structure:
- **Container**: Flex column, `overflow-hidden`, cao cố định (ví dụ: `48px`).
- **Inner Wheel**: Flex column, chứa tất cả các Modes render liên tiếp nhau.
- **Transform**: Dùng `translateY` để hiển thị Mode hiện tại ở giữa viewport.
- **Modes**:
    - **Center (Default)**: Symbol Carousel / Chart Info.
    - **Up/Down**: Các công cụ phụ trợ (Drawing Tools, Actions, Timeframes).
### Interaction Flow:
1.  **Swipe Vertical**: Kéo thanh Bottom Bar lên/xuống để đổi Mode.
2.  **Snap & Swap**:
    - Khi thả tay, tính toán vị trí snap gần nhất.
    - Animate đến vị trí đó.
    - **Atomic Swap**: Khi animation xong, đổi state React (`setMode`) và reset `translate` về 0 ngay lập tức để tạo ảo giác "vô tận" hoặc loops.
3.  **Context-Aware Content**:
    - Nội dung bên trong mỗi Mode có thể thay đổi dựa trên state toàn cục (ví dụ: Tab 'Trade' active -> Hiển thị Trade Form thay vì Action Buttons).
