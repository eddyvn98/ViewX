@echo off
setlocal
echo STARTING MULTI MT5 BRIDGES
echo ==========================
echo.

powershell -ExecutionPolicy Bypass -File scripts\server\start-mt5-bridges.ps1 -Config scripts\server\mt5-bridges.json

echo.
echo Done.
pause
