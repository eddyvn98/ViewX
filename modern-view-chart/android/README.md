# vivutrade Android App

Ứng dụng Android gốc (Native WebView) cho nền tảng giao dịch tài chính **vivutrade.io.vn**.

## Đặc điểm nổi bật
- **Canvas Hardware Acceleration**: Tối ưu hóa card đồ họa phần cứng cho biểu đồ nến (Lightweight Charts) đạt 60fps mượt mà.
- **Trải nghiệm Native**:
  - Thanh trạng thái và thanh điều hướng đồng bộ màu tối `#0b0e14`.
  - Phím Back xử lý thông minh: lùi lại trang trước hoặc nhấn 2 lần để thoát (tránh mất phiên giao dịch).
  - Tự động nhận diện mất mạng và cung cấp màn hình báo lỗi kèm nút "Thử lại".
  - Giữ màn hình luôn sáng (`FLAG_KEEP_SCREEN_ON`) khi đang theo dõi biểu đồ.
  - Hỗ trợ tải file / ảnh chụp màn hình biểu đồ (`WebChromeClient`).
  - Hỗ trợ đầy đủ Google OAuth / Supabase login.
  - Tự động chuyển các link bên ngoài (Telegram, WhatsApp, tel, mailto) sang ứng dụng Android tương ứng.
- **Dung lượng siêu nhẹ**: Chỉ ~3.5 MB.

## Cài đặt và Sử dụng

### 1. File APK đã build sẵn
- File APK nằm trực tiếp tại:
  - `d:\TradingWeb\BE_ViewChart\vivutrade.apk`
  - `d:\TradingWeb\BE_ViewChart\modern-view-chart\android\vivutrade.apk`

### 2. Cài đặt lên điện thoại
- **Cách 1**: Chép file `vivutrade.apk` vào điện thoại Android qua Zalo / Google Drive / cáp USB và bấm cài đặt.
- **Cách 2** (qua cáp USB bật USB Debugging):
  ```powershell
  adb install -r D:\TradingWeb\BE_ViewChart\vivutrade.apk
  ```

### 3. Build lại APK khi cần
Từ thư mục `modern-view-chart`, bạn chỉ cần chạy:
```powershell
npm run android:build
```
Hoặc:
```powershell
.\android\build-apk.ps1
```
