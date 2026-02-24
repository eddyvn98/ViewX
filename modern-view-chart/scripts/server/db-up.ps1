Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ComposeFile = Join-Path $RepoRoot "docker-compose.mongo.yml"

if (-not (Test-Path $ComposeFile)) {
    throw "[db-up] Missing compose file: $ComposeFile"
}

$docker = Get-Command "docker" -ErrorAction SilentlyContinue
if ($null -eq $docker) {
    throw "[db-up] Docker CLI not found. Install Docker Desktop first."
}

Set-Location $RepoRoot
docker compose -f $ComposeFile up -d
if ($LASTEXITCODE -ne 0) {
    throw "[db-up] docker compose up failed with exit code $LASTEXITCODE"
}

Write-Host "[db-up] Mongo container started (viewx-mongo)."
