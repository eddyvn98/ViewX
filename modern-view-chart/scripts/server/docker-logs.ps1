Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $RepoRoot ".env.docker"
$ComposeFile = Join-Path $RepoRoot "docker-compose.yml"

if (-not (Test-Path $ComposeFile)) {
    throw "[docker-logs] Missing compose file: $ComposeFile"
}

$docker = Get-Command "docker" -ErrorAction SilentlyContinue
if ($null -eq $docker) {
    throw "[docker-logs] Docker CLI not found."
}

Set-Location $RepoRoot
if (Test-Path $EnvFile) {
    docker compose --env-file $EnvFile --profile staging logs -f --tail 150 frontend backend viewx-mongo
} else {
    docker compose --profile staging logs -f --tail 150 frontend backend viewx-mongo
}
