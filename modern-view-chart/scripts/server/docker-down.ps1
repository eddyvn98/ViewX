Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $RepoRoot ".env.docker"
$ComposeFile = Join-Path $RepoRoot "docker-compose.yml"

if (-not (Test-Path $ComposeFile)) {
    throw "[docker-down] Missing compose file: $ComposeFile"
}

$docker = Get-Command "docker" -ErrorAction SilentlyContinue
if ($null -eq $docker) {
    throw "[docker-down] Docker CLI not found."
}

Set-Location $RepoRoot

$bridgeStopScript = Join-Path $PSScriptRoot "docker-bridge-stop.ps1"
if (Test-Path $bridgeStopScript) {
    & $bridgeStopScript
}

if (Test-Path $EnvFile) {
    docker compose --env-file $EnvFile --profile staging down
} else {
    docker compose --profile staging down
}

if ($LASTEXITCODE -ne 0) {
    throw "[docker-down] docker compose down failed with exit code $LASTEXITCODE"
}

Write-Host "[docker-down] Staging stack stopped (bridge stopped)."
