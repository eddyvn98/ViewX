Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$targets = Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "python.exe" -and $_.CommandLine -match "backend/bridge/main.py" }

if (-not $targets) {
    Write-Host "[docker-bridge-stop] Bridge is not running."
    exit 0
}

$stopped = 0
foreach ($proc in $targets) {
    try {
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
        Write-Host ("[docker-bridge-stop] Stopped bridge PID=" + $proc.ProcessId)
        $stopped++
    } catch {
        Write-Warning ("[docker-bridge-stop] Failed to stop PID=" + $proc.ProcessId + " (" + $_.Exception.Message + ")")
    }
}

Write-Host ("[docker-bridge-stop] Total stopped: " + $stopped)
