Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$patterns = @(
    "next start",
    "next dev",
    "next\\dist\\bin\\next",
    "next/dist/bin/next",
    "--port 3000",
    "start-server.js",
    "backend/index.js",
    "npm-cli.js"" run server:start",
    "backend/bridge/main.py",
    "start_mobile_access.py",
    "cloudflared.exe tunnel"
)

$killed = 0

$processes = Get-CimInstance Win32_Process
foreach ($proc in $processes) {
    $cmd = $proc.CommandLine
    if ([string]::IsNullOrWhiteSpace($cmd)) {
        continue
    }

    $matched = $false
    foreach ($pattern in $patterns) {
        if ($cmd -like ("*" + $pattern + "*")) {
            $matched = $true
            break
        }
    }

    if ($matched) {
        try {
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
            Write-Host ("[stop-all] Stopped PID " + $proc.ProcessId + " :: " + $cmd)
            $killed++
        }
        catch {
            Write-Warning ("[stop-all] Failed to stop PID " + $proc.ProcessId + ": " + $_.Exception.Message)
        }
    }
}

Write-Host ("[stop-all] Total stopped: " + $killed)
