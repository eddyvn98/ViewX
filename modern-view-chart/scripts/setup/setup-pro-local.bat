@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-pro-local.ps1" -Browser chrome
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo Setup that bai (exit code %EXITCODE%).
  echo Vui long gui file log: "%LOCALAPPDATA%\VivutradePro\logs\setup.log"
  start "" notepad "%LOCALAPPDATA%\VivutradePro\logs\setup.log"
  pause
)
endlocal
