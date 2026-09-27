# vivutrade Android App

Ứng dụng Android native WebView cho nền tảng **https://vivutrade.io.vn**.

## Runtime

- Target production: `https://vivutrade.io.vn`
- Package: `vn.io.vivutrade`
- Min SDK: 26
- Target / compile SDK: 35
- Java: 17
- Production WebView disables remote debugging, cleartext HTTP, and mixed HTTP content.

## Build local

Từ thư mục `modern-view-chart` trên Windows:

```powershell
npm run android:build
```

Hoặc:

```powershell
.\android\build-apk.ps1
```

Script tự tìm `JAVA_HOME`, Android SDK và Gradle từ môi trường; không còn phụ thuộc đường dẫn của một máy cụ thể.

Nếu dùng macOS/Linux, vào `modern-view-chart/android` và chạy Gradle trực tiếp:

```bash
gradle :app:assembleDebug --no-daemon
```

## CI artifact

Workflow `.github/workflows/release-artifacts.yml` build một APK cài được trên GitHub Actions và upload:

- `vivutrade-android.apk`
- `SHA256SUMS.txt`

Đây là artifact QA/sideload được ký bằng debug key của runner. Nếu phát hành Play Store hoặc cần cơ chế update ổn định lâu dài, phải cấu hình release keystore cố định qua GitHub Secrets và build `assembleRelease`.

## Cài đặt

Qua ADB:

```bash
adb install -r vivutrade-android.apk
```

Hoặc chép APK sang điện thoại và cài trực tiếp sau khi cho phép cài ứng dụng từ nguồn tương ứng.
