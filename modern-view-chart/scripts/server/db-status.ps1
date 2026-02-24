Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ComposeFile = Join-Path $RepoRoot "docker-compose.mongo.yml"

$docker = Get-Command "docker" -ErrorAction SilentlyContinue
if ($null -eq $docker) {
    Write-Host "[db-status] Docker CLI not found."
    exit 1
}

if (-not (Test-Path $ComposeFile)) {
    Write-Host "[db-status] Missing compose file: $ComposeFile"
    exit 1
}

Set-Location $RepoRoot
Write-Host "[db-status] docker compose ps"
docker compose -f $ComposeFile ps
if ($LASTEXITCODE -ne 0) {
    Write-Host "[db-status] docker compose ps failed."
    exit 1
}

$portOpen = $false
try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", 27027, $null, $null)
    $portOpen = $iar.AsyncWaitHandle.WaitOne(1500, $false) -and $client.Connected
    $client.Close()
} catch {
    $portOpen = $false
}

Write-Host ("[db-status] Mongo TCP 127.0.0.1:27027 => " + ($(if ($portOpen) { "OPEN" } else { "CLOSED" })))
if (-not $portOpen) {
    exit 1
}
