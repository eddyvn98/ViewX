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


