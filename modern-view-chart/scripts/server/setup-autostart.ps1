Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$RunAllScript = Join-Path $RepoRoot "scripts\server\run-all.ps1"
$BootstrapScript = Join-Path $RepoRoot "scripts\server\bootstrap.ps1"
$WatchdogScript = Join-Path $RepoRoot "scripts\server\watchdog.ps1"
$RotateTokenScript = Join-Path $RepoRoot "scripts\server\rotate-access-token.ps1"
$EnvPath = Join-Path $RepoRoot ".env"

function Get-EnvValue([string]$key) {
    if (-not (Test-Path $EnvPath)) { return "" }
    $line = Get-Content $EnvPath | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if (-not $line) { return "" }
    $value = $line.Split("=", 2)[1].Trim()
    return $value.Trim("'`"")
}

function Register-TaskSafe {
    param(
        [string]$TaskName,
        [string]$ScriptPath,
        [ValidateSet("Startup", "Logon")]
        [string]$Mode
    )

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false | Out-Null
    }

    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
    if ($Mode -eq "Startup") {
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $trigger.Delay = "PT30S"
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
    }
    else {
        $trigger = New-ScheduledTaskTrigger -AtLogOn
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings | Out-Null
    }
}

function Register-WatchdogTask {
    param(
        [string]$TaskName,
        [string]$ScriptPath
    )

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false | Out-Null
    }

    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1)
    $trigger.RepetitionInterval = "PT1M"
    $trigger.RepetitionDuration = "P9999D"
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
}

function Register-RotateTask {
    param(
        [string]$TaskName,
        [string]$ScriptPath
    )

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false | Out-Null
    }

    $rotateTime = Get-EnvValue "TOKEN_ROTATE_CRON_TIME"
    if (-not $rotateTime) { $rotateTime = "03:00" }
    $parts = $rotateTime.Split(":")
    $hour = 3
    $minute = 0
    if ($parts.Count -eq 2) {
        $hour = [int]$parts[0]
        $minute = [int]$parts[1]
    }

    $trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($hour).AddMinutes($minute))
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
}

$startupFolder = [Environment]::GetFolderPath("Startup")
$startupCmdPath = Join-Path $startupFolder "ModernViewChartServer.cmd"
$watchdogStartupCmdPath = Join-Path $startupFolder "ModernViewChartWatchdog.cmd"
$rotateStartupCmdPath = Join-Path $startupFolder "ModernViewChartRotateToken.cmd"

try {
    Register-TaskSafe -TaskName "ModernViewChartServer" -ScriptPath $RunAllScript -Mode "Startup"
    Register-TaskSafe -TaskName "ModernViewChartBootstrap" -ScriptPath $BootstrapScript -Mode "Logon"
    Register-WatchdogTask -TaskName "ModernViewChartWatchdog" -ScriptPath $WatchdogScript
    Register-RotateTask -TaskName "ModernViewChartRotateToken" -ScriptPath $RotateTokenScript
    Disable-ScheduledTask -TaskName "ModernViewChartBootstrap" | Out-Null
    Write-Host "[autostart] Scheduled tasks registered."
}
catch {
    @(
        "@echo off",
        "cd /d `"$RepoRoot`"",
        "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$RunAllScript`""
    ) | Set-Content -Path $startupCmdPath -Encoding ASCII

    @(
        "@echo off",
        "cd /d `"$RepoRoot`"",
        ":loop",
        "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$WatchdogScript`"",
        "timeout /t 60 /nobreak >nul",
        "goto loop"
    ) | Set-Content -Path $watchdogStartupCmdPath -Encoding ASCII

    @(
        "@echo off",
        "cd /d `"$RepoRoot`"",
        ":loop",
        "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$RotateTokenScript`"",
        "timeout /t 300 /nobreak >nul",
        "goto loop"
    ) | Set-Content -Path $rotateStartupCmdPath -Encoding ASCII

    Write-Warning "[autostart] Could not register scheduled tasks. Fallback applied: Startup folder launchers."
    Write-Host ("[autostart] Startup launcher: " + $startupCmdPath)
    Write-Host ("[autostart] Watchdog launcher: " + $watchdogStartupCmdPath)
    Write-Host ("[autostart] Rotate launcher: " + $rotateStartupCmdPath)
}
