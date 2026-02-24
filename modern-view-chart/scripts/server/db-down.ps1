Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ComposeFile = Join-Path $RepoRoot "docker-compose.mongo.yml"

if (-not (Test-Path $ComposeFile)) {
    throw "[db-down] Missing compose file: $ComposeFile"
}

$docker = Get-Command "docker" -ErrorAction SilentlyContinue
if ($null -eq $docker) {
    throw "[db-down] Docker CLI not found."
}

Set-Location $RepoRoot
docker compose -f $ComposeFile down
if ($LASTEXITCODE -ne 0) {
    throw "[db-down] docker compose down failed with exit code $LASTEXITCODE"
}

Write-Host "[db-down] Mongo container stopped."
