@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "scripts\server\sync-and-deploy.ps1" %*
