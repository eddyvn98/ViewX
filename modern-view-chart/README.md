# vivutrade

N?n t?ng trading chart realtime, strategy matrix monitor và backtest analytics.

## Ch?y local

```bash
npm install
npm run dev
```

M? `http://localhost:3000` d? truy c?p ?ng d?ng.

## Build production

```bash
npm run build
npm run start
```

## Tri?n khai nhanh (server scripts)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\bootstrap.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\server\run-all.ps1
```

## Dang ky / dang nhap bang Google

1. Tao OAuth Client ID (Web) tren Google Cloud Console.
2. Them vao `.env`:

```env
GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
# Optional (chi can neu ban muon hardcode phia frontend):
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
```

3. Frontend lay `credential` (Google ID token) va goi:

```ts
await fetch("/api/auth/google", {
  method: "POST",
  headers: { "content-type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ id_token: credential }),
});
```

Backend se tu dong:
- tao tai khoan neu email chua ton tai,
- lien ket tai khoan local theo email neu da ton tai,
- tra ve `access_token`, `refresh_token` giong login thuong.



## Docker staging (FE + BE + Mongo, MT5 bridge ngoai Docker)

1. Tao file env Docker:

```powershell
Copy-Item .env.docker.example .env.docker
```

2. Start stack staging:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\docker-up.ps1
```

3. Chay smoke test:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\docker-smoke.ps1
```

4. Chay MT5 bridge tren host Windows (khong container hoa):

```powershell
python backend/bridge/main.py
```

Yeu cau bridge host:
- `NODE_WS_URL=ws://127.0.0.1:18091`
- `ACCESS_TOKEN` phai trung voi backend trong `.env.docker`

5. Xem log / stop stack:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\server\docker-logs.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\server\docker-down.ps1
```


Bridge command nhanh (lay env tu .env.docker):

```powershell
npm run docker:bridge
```
