@echo off
setlocal
echo STARTING DUAL-TERMINAL BRIDGE SYSTEM (PYTHON 3.11)
echo ===================================
echo.

:: --- CONFIGURATION ---
:: Tìm đường dẫn python.exe hiện tại
for /f "delims=" %%i in ('where python') do set PYTHON_EXE="%%i" & goto :found_python
:found_python
echo Using Python at: %PYTHON_EXE%

:: Replace những đường dẫn này bằng đường dẫn thực tế trên máy bạn
set DEMO_PATH="C:\Program Files\MetaTrader 5 EXNESS\terminal64.exe"
set REAL_PATH="D:\MT5_Real\terminal64.exe"

echo 1. Starting DEMO Bridge (Name: MT5)...
start "MT5 DEMO BRIDGE" %PYTHON_EXE% backend/bridge/main.py --name "MT5" --path %DEMO_PATH%
echo.

echo 2. Starting REAL Bridge (Name: real)...
start "MT5 REAL BRIDGE" %PYTHON_EXE% backend/bridge/main.py --name "real" --path %REAL_PATH%
echo.

echo Bridges launched! 
echo Open your Web Dashboard and configure your charts with source "demo" or "real".
echo.
pause
