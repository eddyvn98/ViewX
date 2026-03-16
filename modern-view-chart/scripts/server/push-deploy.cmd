@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-deploy.ps1" %*
