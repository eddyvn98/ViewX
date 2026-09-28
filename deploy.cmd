@echo off
setlocal
cd /d "%~dp0\modern-view-chart"
powershell -ExecutionPolicy Bypass -File "scripts\server\sync-and-deploy.ps1" %*
