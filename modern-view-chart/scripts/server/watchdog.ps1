Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogsDir = Join-Path $RepoRoot "logs"
$NpmCmd = "C:\Program Files\nodejs\npm.cmd"
$NodeHome = "C:\Program Files\nodejs"
$PythonCmd = "C:\Users\eddyvn\AppData\Local\Programs\Python\Python310\python.exe"
$DbUpScript = Join-Path $PSScriptRoot "db-up.ps1"

if (-not ($env:Path -split ";" | Where-Object { $_ -eq $NodeHome })) {
    $env:Path = "$NodeHome;$env:Path"
}

if (-not (Test-Path $PythonCmd)) {
    $pythonLookup = Get-Command "python" -ErrorAction SilentlyContinue
    if ($null -ne $pythonLookup) {
        $PythonCmd = $pythonLookup.Source
    }
}

New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null

function Get-EnvValue([string]$key) {
    $envPath = Join-Path $RepoRoot ".env"
    if (-not (Test-Path $envPath)) { return "" }

    $line = Get-Content $envPath | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if (-not $line) { return "" }
    $value = $line.Split("=", 2)[1].Trim()
    return $value.Trim("'`"")
}

function Test-HttpOk([string]$url) {
    try {
        $resp = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 8
        return $resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300
    }
    catch {
        return $false
    }
}

function Get-HealthJson {
    $token = Get-EnvValue "ACCESS_TOKEN"
    if (-not $token) { return $null }

    $healthUrl = "http://127.0.0.1:8091/api/health?access_token=$token"
    try {
        return Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 8
    } catch {
        return $null
    }
}

function Find-ProcessByPattern([string]$pattern) {
    return Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -and $_.CommandLine -like "*$pattern*"
    }
}

function Ensure-Database {
    if (-not (Test-Path $DbUpScript)) { return }

    $health = Get-HealthJson
    $dbState = $null
    if ($null -ne $health -and $health.db) {
        $dbState = [string]$health.db.state
    }

    if ($dbState -eq "connected" -or $dbState -eq "connecting") {
        return
    }

    try {
        Write-Host "[watchdog] Ensuring MongoDB container..."
        & $DbUpScript | Out-Null
    }
    catch {
        Write-Warning ("[watchdog] MongoDB ensure failed: " + $_.Exception.Message)
    }
}

function Ensure-Frontend {
    $frontendUp = Test-HttpOk "http://127.0.0.1:3000"
    $frontendProc = Find-ProcessByPattern "next start --hostname 0.0.0.0 --port 3000"
    if ($frontendUp -and $frontendProc) { return }

    Write-Host "[watchdog] Restarting frontend..."
    Start-Process -FilePath $NpmCmd `
        -ArgumentList 'run start -- --hostname 0.0.0.0 --port 3000' `
        -WorkingDirectory $RepoRoot `
        -RedirectStandardOutput (Join-Path $LogsDir "frontend.log") `
        -RedirectStandardError (Join-Path $LogsDir "frontend.err.log") `
        | Out-Null
}

function Ensure-Backend {
    $token = Get-EnvValue "ACCESS_TOKEN"
    $healthUrl = "http://127.0.0.1:8091/api/health"
    if ($token) {
        $healthUrl += "?access_token=$token"
    }
    $backendUp = Test-HttpOk $healthUrl
    $backendProc = Find-ProcessByPattern "backend/index.js"
    if ($backendUp -and $backendProc) { return }

    Write-Host "[watchdog] Restarting backend..."
    $backendCmd = 'set PORT=8091 && "C:\Program Files\nodejs\npm.cmd" run server:start'
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList @("/c", $backendCmd) `
        -WorkingDirectory $RepoRoot `
        -RedirectStandardOutput (Join-Path $LogsDir "backend.log") `
        -RedirectStandardError (Join-Path $LogsDir "backend.err.log") `
        | Out-Null
}

function Ensure-Bridge {
    $bridgeProc = Find-ProcessByPattern "backend/bridge/main.py"
    if ($bridgeProc) { return }

    Write-Host "[watchdog] Restarting bridge..."
    Start-Process -FilePath $PythonCmd `
        -ArgumentList @("-u", "backend/bridge/main.py") `
        -WorkingDirectory $RepoRoot `
        -RedirectStandardOutput (Join-Path $LogsDir "bridge.log") `
        -RedirectStandardError (Join-Path $LogsDir "bridge.err.log") `
        | Out-Null
}

function Ensure-Tunnel {
    $tunnelProc = Find-ProcessByPattern "start_mobile_access.py"
    if ($tunnelProc) { return }

    Write-Host "[watchdog] Restarting quick tunnel..."
    Start-Process -FilePath $PythonCmd `
        -ArgumentList @("-u", "start_mobile_access.py") `
        -WorkingDirectory $RepoRoot `
        -RedirectStandardOutput (Join-Path $LogsDir "tunnel.log") `
        -RedirectStandardError (Join-Path $LogsDir "tunnel.err.log") `
        | Out-Null
}

Set-Location $RepoRoot
Ensure-Database
Ensure-Frontend
Ensure-Backend
Ensure-Bridge
Ensure-Tunnel
