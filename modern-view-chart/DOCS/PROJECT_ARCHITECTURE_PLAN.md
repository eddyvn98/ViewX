# Chiến lược Kiến trúc Hệ thống: Hybrid Trading Platform

Tài liệu này lưu trữ lộ trình phát triển hệ thống từ mô hình máy khách (Client-side) sang mô hình máy chủ cá nhân (Self-hosted Server) dựa trên thảo luận ngày 12/02/2026.

## 1. Mô hình Vận hành (Hybrid Model)
- **Giai đoạn Hiện tại (Client-side):** 
    - Logic chạy trực tiếp trên trình duyệt người dùng.
    - Tiết kiệm chi phí server, bảo mật chiến lược cho khách hàng.
    - Hạn chế: Phải mở Web mới chạy bot.
- **Giai đoạn Mở rộng (Server-side):**
    - Đưa logic (`BacktestRunner`, `RuleEngine`) lên Node.js chạy ngầm.
    - Cho phép chạy bot 24/7 và gửi cảnh báo Telegram ngay cả khi tắt Web.

## 2. Giải pháp Server tại nhà (Local PC Server)
- **Database:** Sử dụng PostgreSQL hoặc SQLite cài đặt trực tiếp trên ổ cứng (thay thế Supabase).
- **Kết nối Internet:** Sử dụng **Cloudflare Tunnel** để ánh xạ máy cá nhân ra tên miền công cộng (hathatrade.com) mà không cần mở Port modem.
- **Quản lý quy trình:** Dùng **PM2** để duy trì Backend luôn chạy ngầm 24/7.
- **Nguồn dữ liệu:** Lấy dữ liệu Tick/Candle trực tiếp từ MT5 đang chạy trên cùng máy tính.

## 3. Hệ thống Cảnh báo & Tương tác
- **Telegram Alert:** 
    - Gói Free: Cảnh báo giá đơn giản (Price Alert) chạy trên server.
    - Gói VIP: Chạy bot chiến lược (Strategy Alert) tính toán RSI/HA trên server.
- **Bot Telegram:** Sử dụng Telegram Bot API kết nối với Database local để gửi tin nhắn theo User ID.

## 4. Giải pháp Đăng nhập (Authentication)
- **Công nghệ:** NextAuth.js (Auth.js).
- **Phương thức:** Đăng nhập Google (Social Login).
- **Lưu trữ:** Thông tin người dùng từ Google sẽ được tự động lưu vào Database local thông qua các Adapter (Prisma/Drizzle).

## 5. Phân bổ Tính toán (Scaling 1000+ Users)
- **Data Broadcaster:** Server làm nhiệm vụ nhận dữ liệu MT5 và bắn cho 1000 WebSockets.
- **Logic Runner:** 
    - Ưu tiên tính toán tại trình duyệt khách hàng để giảm tải server.
    - Chỉ chạy logic tại server cho các tài khoản đăng ký lưu bot trên cloud.

---
*Tài liệu này được tạo để làm cơ sở cho việc triển khai code trong tương lai.*
