@echo off
echo STARTING DUAL-TERMINAL BRIDGE SYSTEM
echo ===================================
echo.
echo [IMPORTANT] Make sure you have edited this file to point to your ACTUAL MT5 installation paths!
echo.

:: --- CONFIGURATION ---
:: Replace these paths with your actual MT5 terminal64.exe paths
set DEMO_PATH="C:\Program Files\MetaTrader 5 EXNESS\terminal64.exe"
set REAL_PATH="D:\MT5_Real\terminal64.exe"

echo 1. Starting DEMO Bridge (Name: MT5)...
start "MT5 DEMO BRIDGE" python backend/bridge/main.py --name "MT5" --path %DEMO_PATH%
echo.

echo 2. Starting REAL Bridge (Name: real)...
start "MT5 REAL BRIDGE" python backend/bridge/main.py --name "real" --path %REAL_PATH%
echo.

echo Bridges launched! 
echo Open your Web Dashboard and configure your charts with source "demo" or "real".
echo.
pause
