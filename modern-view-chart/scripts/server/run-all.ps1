Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$NpmCmd = "C:\Program Files\nodejs\npm.cmd"
$NodeHome = "C:\Program Files\nodejs"
$PythonCmd = "C:\Users\eddyvn\AppData\Local\Programs\Python\Python310\python.exe"
$LogsDir = Join-Path $RepoRoot "logs"

if (-not (Test-Path $NpmCmd)) {
    throw "npm not found at '$NpmCmd'. Install Node.js LTS first."
}

if (-not ($env:Path -split ";" | Where-Object { $_ -eq $NodeHome })) {
    $env:Path = "$NodeHome;$env:Path"
}

if (-not (Test-Path $PythonCmd)) {
    $pythonLookup = Get-Command "python" -ErrorAction SilentlyContinue
    if ($null -eq $pythonLookup) {
        throw "python is not available."
    }

    $PythonCmd = $pythonLookup.Source
}

Set-Location $RepoRoot
New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null

$dbUpScript = Join-Path $PSScriptRoot "db-up.ps1"
if (Test-Path $dbUpScript) {
    try {
        Write-Host "[run-all] Ensuring MongoDB container is running..."
        & $dbUpScript
    }
    catch {
        Write-Warning ("[run-all] MongoDB startup skipped: " + $_.Exception.Message)
    }
}

$stopScript = Join-Path $PSScriptRoot "stop-all.ps1"
if (Test-Path $stopScript) {
    & $stopScript | Out-Null
}

$FrontendLog = Join-Path $LogsDir "frontend.log"
$FrontendErrLog = Join-Path $LogsDir "frontend.err.log"
$BackendLog = Join-Path $LogsDir "backend.log"
$BackendErrLog = Join-Path $LogsDir "backend.err.log"
$BridgeLog = Join-Path $LogsDir "bridge.log"
$BridgeErrLog = Join-Path $LogsDir "bridge.err.log"
$TunnelLog = Join-Path $LogsDir "tunnel.log"
$TunnelErrLog = Join-Path $LogsDir "tunnel.err.log"
$BuildIdPath = Join-Path $RepoRoot ".next\BUILD_ID"

if (Test-Path $BuildIdPath) {
    $frontendArgs = 'run start -- --hostname 0.0.0.0 --port 3000'
    Write-Host "[run-all] Found production build. Starting frontend (next start) on :3000"
}
else {
    $frontendArgs = 'run dev -- --hostname 0.0.0.0 --port 3000'
    Write-Host "[run-all] No production build found. Starting frontend fallback (next dev) on :3000"
}

$frontend = Start-Process -FilePath $NpmCmd `
    -ArgumentList $frontendArgs `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $FrontendLog `
    -RedirectStandardError $FrontendErrLog `
    -PassThru

Write-Host "[run-all] Starting backend on :8091"
$backendCmd = 'set PORT=8091 && "C:\Program Files\nodejs\npm.cmd" run server:start'
$backend = Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/c", $backendCmd) `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $BackendLog `
    -RedirectStandardError $BackendErrLog `
    -PassThru

Write-Host "[run-all] Starting MT5 bridge"
$bridge = Start-Process -FilePath $PythonCmd `
    -ArgumentList @("-u", "backend/bridge/main.py") `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $BridgeLog `
    -RedirectStandardError $BridgeErrLog `
    -PassThru

Write-Host "[run-all] Starting Cloudflare quick tunnels"
$tunnel = Start-Process -FilePath $PythonCmd `
    -ArgumentList @("-u", "start_mobile_access.py") `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $TunnelLog `
    -RedirectStandardError $TunnelErrLog `
    -PassThru

Start-Sleep -Seconds 2
if ($tunnel.HasExited) {
    throw "Tunnel process exited early with code $($tunnel.ExitCode). Check logs\\tunnel.err.log"
}

Write-Host "[run-all] Started processes:"
Write-Host ("  FE PID: " + $frontend.Id)
Write-Host ("  BE PID: " + $backend.Id)
Write-Host ("  Bridge PID: " + $bridge.Id)
Write-Host ("  Tunnel PID: " + $tunnel.Id)
Write-Host ("  Logs: " + $LogsDir)
