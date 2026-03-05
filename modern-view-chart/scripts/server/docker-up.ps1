Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $RepoRoot ".env.docker"
$ComposeFile = Join-Path $RepoRoot "docker-compose.yml"

if (-not (Test-Path $ComposeFile)) {
    throw "[docker-up] Missing compose file: $ComposeFile"
}

if (-not (Test-Path $EnvFile)) {
    throw "[docker-up] Missing .env.docker. Create it from .env.docker.example first."
}

$docker = Get-Command "docker" -ErrorAction SilentlyContinue
if ($null -eq $docker) {
    throw "[docker-up] Docker CLI not found. Install Docker Desktop first."
}

Set-Location $RepoRoot
docker compose --env-file $EnvFile --profile staging up -d --build
if ($LASTEXITCODE -ne 0) {
    throw "[docker-up] docker compose up failed with exit code $LASTEXITCODE"
}

$bridgeStartScript = Join-Path $PSScriptRoot "docker-bridge-start.ps1"
if (Test-Path $bridgeStartScript) {
    & $bridgeStartScript
}

Write-Host "[docker-up] Staging stack is up with MT5 bridge."
