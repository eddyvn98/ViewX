Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $RepoRoot ".env.docker"
$LogsDir = Join-Path $RepoRoot "logs"

if (-not (Test-Path $EnvFile)) {
    throw "[docker-bridge-start] Missing .env.docker. Create it from .env.docker.example first."
}

function Get-EnvValue([string]$key) {
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if (-not $line) { return "" }
    return $line.Split("=", 2)[1].Trim()
}

$nodeWs = Get-EnvValue "NODE_WS_URL"
$accessToken = Get-EnvValue "ACCESS_TOKEN"
if ([string]::IsNullOrWhiteSpace($nodeWs)) { throw "[docker-bridge-start] NODE_WS_URL missing in .env.docker" }
if ([string]::IsNullOrWhiteSpace($accessToken)) { throw "[docker-bridge-start] ACCESS_TOKEN missing in .env.docker" }

$python = Get-Command "python" -ErrorAction SilentlyContinue
if ($null -eq $python) { throw "[docker-bridge-start] python is not available." }

$candidates = Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq "python.exe" -and $_.CommandLine -match "backend/bridge/main.py" }
$existing = $null
foreach ($candidate in $candidates) {
    if (Get-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue) {
        $existing = $candidate
        break
    }
}
if ($existing) {
    Write-Host ("[docker-bridge-start] Bridge already running. PID=" + $existing.ProcessId)
    exit 0
}

New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
Set-Location $RepoRoot
$env:NODE_WS_URL = $nodeWs
$env:ACCESS_TOKEN = $accessToken

$outLog = Join-Path $LogsDir "bridge-docker.out.log"
$errLog = Join-Path $LogsDir "bridge-docker.err.log"
$proc = Start-Process -FilePath $python.Source `
    -ArgumentList @("-u", "backend/bridge/main.py") `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru

Write-Host ("[docker-bridge-start] Bridge started. PID=" + $proc.Id + " NODE_WS_URL=" + $nodeWs)
