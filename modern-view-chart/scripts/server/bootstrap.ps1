Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$NpmCmd = "C:\Program Files\nodejs\npm.cmd"
$NodeHome = "C:\Program Files\nodejs"

if (-not (Test-Path $NpmCmd)) {
    throw "npm not found at '$NpmCmd'. Install Node.js LTS first."
}

if (-not ($env:Path -split ";" | Where-Object { $_ -eq $NodeHome })) {
    $env:Path = "$NodeHome;$env:Path"
}

Set-Location $RepoRoot

if ((-not (Test-Path "node_modules")) -or (-not (Test-Path "node_modules\\.bin\\next.cmd"))) {
    Write-Host "[bootstrap] Installing dependencies..."
    & $NpmCmd install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
    }
}
else {
    Write-Host "[bootstrap] node_modules exists. Skipping npm install."
}

Write-Host "[bootstrap] Building frontend..."
& $NpmCmd run build
if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed with exit code $LASTEXITCODE"
}

Write-Host "[bootstrap] Completed successfully."
