@echo off
title ViewX - Multi-Terminal Dev Launcher
echo ==========================================
echo    LAUNCHING VIEWX ALL-IN-ONE SERVICES
echo ==========================================
echo.

echo [1/4] Starting FRONTEND (Next.js on :3000)...
start "VIEWX_FRONTEND" cmd /k "npm run dev"

timeout /t 2 /nobreak > nul

echo [2/4] Starting BACKEND (Express on :8091)...
start "VIEWX_BACKEND" cmd /k "npm run server:dev"

timeout /t 2 /nobreak > nul

echo [3/4] Starting MT5 BRIDGE (Single Instance)...
start "VIEWX_BRIDGE" cmd /k "python backend/bridge/main.py"

timeout /t 2 /nobreak > nul

echo [4/4] Starting CLOUDFLARE TUNNEL (Mobile Access)...
start "VIEWX_TUNNEL" cmd /k "python start_mobile_access.py"

echo.
echo ==========================================
echo    ALL SERVICES ARE LAUNCHED!
echo ==========================================
echo.
echo Windows opened:
echo  1. Frontend (Next.js)
echo  2. Backend (Express)
echo  3. Bridge (Single Instance)
echo  4. Tunnel (Cloudflare)
echo.
pause
