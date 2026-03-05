Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $RepoRoot ".env.docker"

if (-not (Test-Path $EnvFile)) {
    throw "[docker-bridge] Missing .env.docker. Create it from .env.docker.example first."
}

function Get-EnvValue([string]$key) {
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if (-not $line) { return "" }
    return $line.Split("=", 2)[1].Trim()
}

$nodeWs = Get-EnvValue "NODE_WS_URL"
$accessToken = Get-EnvValue "ACCESS_TOKEN"

if ([string]::IsNullOrWhiteSpace($nodeWs)) {
    throw "[docker-bridge] NODE_WS_URL missing in .env.docker"
}
if ([string]::IsNullOrWhiteSpace($accessToken)) {
    throw "[docker-bridge] ACCESS_TOKEN missing in .env.docker"
}

$python = Get-Command "python" -ErrorAction SilentlyContinue
if ($null -eq $python) {
    throw "[docker-bridge] python is not available."
}

Set-Location $RepoRoot
$env:NODE_WS_URL = $nodeWs
$env:ACCESS_TOKEN = $accessToken

Write-Host ("[docker-bridge] NODE_WS_URL=" + $env:NODE_WS_URL)
Write-Host "[docker-bridge] Starting MT5 bridge on host..."
& $python.Source -u "backend/bridge/main.py"
