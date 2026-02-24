Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$RunAllScript = Join-Path $RepoRoot "scripts\server\run-all.ps1"
$BootstrapScript = Join-Path $RepoRoot "scripts\server\bootstrap.ps1"

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

$startupFolder = [Environment]::GetFolderPath("Startup")
$startupCmdPath = Join-Path $startupFolder "ModernViewChartServer.cmd"

try {
    Register-TaskSafe -TaskName "ModernViewChartServer" -ScriptPath $RunAllScript -Mode "Startup"
    Register-TaskSafe -TaskName "ModernViewChartBootstrap" -ScriptPath $BootstrapScript -Mode "Logon"
    Disable-ScheduledTask -TaskName "ModernViewChartBootstrap" | Out-Null
    Write-Host "[autostart] Scheduled tasks registered."
}
catch {
    @(
        "@echo off",
        "cd /d `"$RepoRoot`"",
        "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$RunAllScript`""
    ) | Set-Content -Path $startupCmdPath -Encoding ASCII
    Write-Warning "[autostart] Could not register scheduled tasks. Fallback applied: Startup folder launcher."
    Write-Host ("[autostart] Startup launcher: " + $startupCmdPath)
}
