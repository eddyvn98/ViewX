# AdGuard Home Docker Setup (Windows) - Ghi chu thao tac

Cap nhat lan cuoi: 2026-03-28
May chu AdGuard: 192.168.1.13
Router: 192.168.1.1 (ZTE ZXHN F6601P - Viettel)

## 1) Muc tieu cau hinh
- Chan quang cao DNS qua AdGuard Home.
- Neu Docker/AdGuard sap, van vao mang binh thuong (fallback DNS).

## 2) Cau hinh da ap dung
### Docker container
- Ten container: `adguardhome`
- Image: `adguard/adguardhome:latest`
- Restart policy: `unless-stopped`
- Volumes:
  - `C:\adguardhome\work -> /opt/adguardhome/work`
  - `C:\adguardhome\conf -> /opt/adguardhome/conf`
- Port mappings dang dung:
  - `53/tcp`, `53/udp`
  - `8081/tcp` (web UI)
  - `8443/tcp`, `8443/udp` (HTTPS)

Luu y: KHONG map `67/68 udp` (xung dot DHCP tren Windows).

### Router DHCP DNS (da set)
- ISP DNS: `Off`
- Primary DNS: `192.168.1.13`
- Secondary DNS: `1.1.1.1`

=> Ket qua: AdGuard dung thi chan ads, AdGuard dung thi DNS tu roi sang 1.1.1.1.

## 3) Thong tin dang nhap AdGuard
- URL local: `http://localhost:8081`
- URL LAN: `http://192.168.1.13:8081`
- Username: `admin`
- Password hien tai: `Adguard@12345`

Khuyen nghi: doi mat khau ngay trong AdGuard Home (Settings -> General settings -> change password).

## 4) Script tu khoi phuc container
- File: `C:\adguardhome\scripts\watchdog.ps1`
- Task Scheduler: `AdGuardHomeWatchdog`
- Chu ky: moi 1 phut
- Chuc nang:
  - Neu khong co container `adguardhome` -> tao lai dung cau hinh.
  - Neu container dung -> `docker start adguardhome`.

## 5) Lenh van hanh nhanh
### Kiem tra trang thai
```powershell
docker ps --filter "name=adguardhome"
```

### Xem log
```powershell
docker logs --tail 100 adguardhome
```

### Restart AdGuard
```powershell
docker restart adguardhome
```

### Dung/bat thu cong
```powershell
docker stop adguardhome
docker start adguardhome
```

## 6) Lenh tao lai container dung cau hinh chuan
```powershell
docker stop adguardhome
docker rm adguardhome

docker run -d --name adguardhome --restart unless-stopped `
  -v C:\adguardhome\work:/opt/adguardhome/work `
  -v C:\adguardhome\conf:/opt/adguardhome/conf `
  -p 53:53/tcp -p 53:53/udp `
  -p 8081:80/tcp -p 8443:443/tcp -p 8443:443/udp `
  adguard/adguardhome
```

## 7) Cach test nhanh sau khi sua cau hinh
### Test AdGuard DNS dang chay
```powershell
nslookup google.com 192.168.1.13
```

### Test domain quang cao bi chan
```powershell
nslookup doubleclick.net 192.168.1.13
```
Mong doi: tra ve `0.0.0.0` hoac `::`.

### Test fallback neu AdGuard dung
```powershell
docker stop adguardhome
nslookup google.com
docker start adguardhome
```
Mong doi: van resolve duoc google.com khi container da stop.

## 8) Vi tri file cau hinh quan trong
- AdGuard yaml: `C:\adguardhome\conf\AdGuardHome.yaml`
- Du lieu/filters: `C:\adguardhome\work\data\filters\`
- Watchdog script: `C:\adguardhome\scripts\watchdog.ps1`

## 9) Su co da gap va cach tranh
- Trieu chung: khong vao duoc `192.168.1.1`, IP thanh `169.254.x.x`.
- Nguyen nhan: map `67/68 udp` gay xung dot DHCP client tren Windows.
- Cach fix: bo map `67/68`, recreate container theo muc 6.

## 10) Ghi chu thay doi sau nay
Neu doi IP may chu AdGuard (vi du khong con 192.168.1.13), can doi lai:
1. Router Primary DNS -> IP moi cua may AdGuard.
2. Kiem tra lai bang `nslookup google.com <IP-moi>`.


## 11) Ghi chu YouTube Ads
- DNS-level block (AdGuard Home/Pi-hole) KHONG the chan on dinh quang cao YouTube vi YouTube phuc vu ads cung domain/CDN voi noi dung video.
- Do do xem YouTube van co the thay ads la binh thuong.
- Cach giam ads hieu qua hon:
  1) Trinh duyet + extension (uBlock Origin) tren PC.
  2) YouTube Premium.
  3) SmartTube tren Android TV (neu phu hop nhu cau).

