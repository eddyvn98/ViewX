Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $RepoRoot ".env.docker"
$ComposeFile = Join-Path $RepoRoot "docker-compose.yml"

if (-not (Test-Path $ComposeFile)) {
    throw "[docker-smoke] Missing compose file: $ComposeFile"
}

$docker = Get-Command "docker" -ErrorAction SilentlyContinue
if ($null -eq $docker) {
    throw "[docker-smoke] Docker CLI not found."
}

Set-Location $RepoRoot

if (Test-Path $EnvFile) {
    docker compose --env-file $EnvFile --profile staging ps
} else {
    docker compose --profile staging ps
}

if ($LASTEXITCODE -ne 0) {
    throw "[docker-smoke] docker compose ps failed."
}

function Get-EnvValue([string]$key, [string]$fallback) {
    if (-not (Test-Path $EnvFile)) { return $fallback }
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if (-not $line) { return $fallback }
    $value = $line.Split("=", 2)[1].Trim()
    if ([string]::IsNullOrWhiteSpace($value)) { return $fallback }
    return $value
}

function Assert-HttpOk([string]$url, [string]$name) {
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
            throw "$name returned status $($response.StatusCode)"
        }
        Write-Host ("[docker-smoke] OK " + $name + " => " + $response.StatusCode)
    }
    catch {
        throw "[docker-smoke] FAIL $name ($url): $($_.Exception.Message)"
    }
}

$backendPort = Get-EnvValue "BACKEND_HOST_PORT" "18091"
$frontendPort = Get-EnvValue "FRONTEND_HOST_PORT" "13000"

Assert-HttpOk ("http://127.0.0.1:$backendPort/api/health") "backend health"
Assert-HttpOk ("http://127.0.0.1:$frontendPort") "frontend home"

Write-Host "[docker-smoke] Basic staging checks passed."
Write-Host "[docker-smoke] Next manual checks:"
Write-Host "  1) Start bridge on host: python backend/bridge/main.py"
Write-Host ("  2) Ensure NODE_WS_URL=ws://127.0.0.1:" + $backendPort + " and ACCESS_TOKEN matches backend.")
Write-Host "  3) Verify bridge_online=true in /api/health and MT5 updates in UI."
