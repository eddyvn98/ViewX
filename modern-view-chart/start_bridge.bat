@echo off
setlocal
echo STARTING VIVUTRADE SINGLE BRIDGE (PYTHON 3.11)
echo ===========================================
echo.

:: --- CONFIGURATION ---
:: Tìm đường dẫn python.exe chuẩn trỏ tới 3.11
for /f "delims=" %%i in ('where python') do set PYTHON_EXE="%%i" & goto :found_python
:found_python
echo Using Python at: %PYTHON_EXE%

:: Đường dẫn Terminal MT5 mặc định (Bạn có thể sửa nếu khác)
set MT5_PATH="C:\Program Files\MetaTrader 5 EXNESS\terminal64.exe"

echo Starting Bridge (Name: MT5)...
%PYTHON_EXE% backend/bridge/main.py --name "MT5" --path %MT5_PATH%
echo.

echo Bridge process finished.
pause
