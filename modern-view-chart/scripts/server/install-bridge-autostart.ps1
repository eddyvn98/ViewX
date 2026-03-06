Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$TaskNameLogon = "VivuTrade-Bridge-Autostart-Logon"
$TaskNameMinute = "VivuTrade-Bridge-Autostart-Minute"
$ScriptPath = "D:\viewx\ViewX\modern-view-chart\scripts\server\docker-bridge-start.ps1"

if (-not (Test-Path $ScriptPath)) {
    throw "[install-bridge-autostart] Missing script: $ScriptPath"
}

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskAction = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

cmd /c "schtasks /Delete /TN ""$TaskNameLogon"" /F >nul 2>nul" | Out-Null
cmd /c "schtasks /Delete /TN ""$TaskNameMinute"" /F >nul 2>nul" | Out-Null

schtasks /Create /TN $TaskNameLogon /TR $taskAction /SC ONLOGON /RU $currentUser /RL LIMITED /F | Out-Null
schtasks /Create /TN $TaskNameMinute /TR $taskAction /SC MINUTE /MO 1 /RU $currentUser /RL LIMITED /F | Out-Null

Write-Host "[install-bridge-autostart] Installed."
Write-Host ("[install-bridge-autostart] Tasks: " + $TaskNameLogon + ", " + $TaskNameMinute)
Write-Host "[install-bridge-autostart] Triggers: ONLOGON and every 1 minute"
