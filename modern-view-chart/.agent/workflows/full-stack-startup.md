---
description: Khởi động toàn bộ Vivutrade và POSWeb (Docker + MT5 Bridge + Tunnels)
---

# Quy trình khởi động hệ thống Vivutrade

Workflow này khởi động 2 dự án chính:
1. **Vivutrade Chart**: https://vivutrade.io.vn
2. **POSWeb**: https://posweb.vivutrade.io.vn

### Bước 1: Khởi động Vivutrade Chart (và MT5 Bridge)
// turbo
1. Di chuyển đến `d:\viewx\ViewX\modern-view-chart` và chạy lệnh sau (đảm bảo Terminal MetaTrader 5 đã được mở):
```powershell
npm run docker:up
```

### Bước 2: Khởi động POSWeb
// turbo
2. Di chuyển đến `D:\posweb` và chạy lệnh sau (đã cấu hình tránh xung đột cổng 80):
```powershell
docker compose -f docker-compose.posweb.yml up -d --build
```

### Bước 3: Kích hoạt Cloudflare Tunnel công khai ra Internet
// turbo
3. Chạy lệnh sau để kết nối 2 tên miền vào hạ tầng Docker:
```powershell
d:\viewx\ViewX\modern-view-chart\cloudflared.exe tunnel run viewx-prod
```

### Bước 4: Kiểm tra trạng thái cuối cùng
4. Kiểm tra sức khỏe tại:
- [https://vivutrade.io.vn/api/health](https://vivutrade.io.vn/api/health) (bridge_online: true)
- [https://posweb.vivutrade.io.vn/health](https://posweb.vivutrade.io.vn/health) (trả về "ok")
