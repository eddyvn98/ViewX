param(
    [switch]$ForceBuild = $false,
    [switch]$SkipTests = $false,
    [switch]$SkipGitNexus = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Resolve-Path (Join-Path $scriptDir "..\..")
$repoRoot = Resolve-Path (Join-Path $appDir "..")

function Assert-LastExitCode([string]$Step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  VIEWX - SAFE PRODUCTION SYNC & DEPLOY" -ForegroundColor Cyan
Write-Host "  App directory : $appDir"
Write-Host "  Repo root     : $repoRoot"
Write-Host "==========================================================" -ForegroundColor Cyan

# Production deploys must always come from committed origin/main.
Push-Location $repoRoot
try {
    $status = & git status --porcelain
    Assert-LastExitCode "git status"
    if ($status) {
        throw "[Deploy] Working tree is dirty. Commit, discard, or stash local changes before production deploy."
    }

    $currentBranch = (& git branch --show-current).Trim()
    Assert-LastExitCode "git branch --show-current"
    if ($currentBranch -ne "main") {
        Write-Host "[Deploy] Switching from '$currentBranch' to 'main'..." -ForegroundColor Yellow
        & git switch main
        Assert-LastExitCode "git switch main"
    }

    $oldHead = (& git rev-parse HEAD).Trim()
    Assert-LastExitCode "git rev-parse HEAD"

    Write-Host "[Deploy] Fetching origin/main..." -ForegroundColor Cyan
    & git fetch origin main
    Assert-LastExitCode "git fetch origin main"

    Write-Host "[Deploy] Fast-forwarding local main to origin/main..." -ForegroundColor Cyan
    & git merge --ff-only origin/main
    Assert-LastExitCode "git merge --ff-only origin/main"

    $newHead = (& git rev-parse HEAD).Trim()
    Assert-LastExitCode "git rev-parse HEAD"

    $diffFiles = @()
    if ($oldHead -ne $newHead) {
        $diffFiles = @(& git diff "$oldHead..$newHead" --name-only)
        Assert-LastExitCode "git diff"
        Write-Host "[Deploy] Updated $oldHead -> $newHead" -ForegroundColor Green
        $diffFiles | ForEach-Object { Write-Host "  -> $_" }
    } else {
        Write-Host "[Deploy] Already on latest origin/main ($newHead)." -ForegroundColor Green
    }
}
finally {
    Pop-Location
}

Push-Location $appDir
try {
    $frontendChanged = @($diffFiles | Where-Object {
        $_ -match "^modern-view-chart/src/" -or
        $_ -match "^modern-view-chart/public/" -or
        $_ -match "^modern-view-chart/package(-lock)?\.json$" -or
        $_ -match "^modern-view-chart/next\.config"
    }).Count -gt 0

    if ($ForceBuild -or $frontendChanged) {
        Write-Host "[Deploy] Building Next.js frontend..." -ForegroundColor Cyan
        & npm run build
        Assert-LastExitCode "npm run build"
    } else {
        Write-Host "[Deploy] No frontend changes detected. Skipping Next.js build." -ForegroundColor Green
    }

    if (-not $SkipTests) {
        Write-Host "[Deploy] Running backend runtime tests..." -ForegroundColor Cyan
        & npm run test:backend-runtime
        Assert-LastExitCode "npm run test:backend-runtime"

        Write-Host "[Deploy] Running unit tests..." -ForegroundColor Cyan
        & npm run test:unit
        Assert-LastExitCode "npm run test:unit"
    }

    Write-Host "[Deploy] Restarting PM2 services..." -ForegroundColor Cyan
    & pm2 restart viewx-backend-semi viewx-frontend-semi viewx-bridge-semi
    Assert-LastExitCode "pm2 restart"

    Write-Host "[Deploy] Waiting for services to settle..." -ForegroundColor Cyan
    Start-Sleep -Seconds 4

    Write-Host "[Deploy] Checking backend health..." -ForegroundColor Cyan
    & curl.exe -fsS http://localhost:18091/api/health
    Assert-LastExitCode "backend health check"
    Write-Host ""

    Write-Host "[Deploy] Running live WebSocket auth smoke..." -ForegroundColor Cyan
    & node scripts/server/ws-auth-smoke.mjs --ws-url "wss://api.vivutrade.io.vn"
    Assert-LastExitCode "WebSocket auth smoke"
}
finally {
    Pop-Location
}

if (-not $SkipGitNexus) {
    Write-Host "[Deploy] Refreshing GitNexus index..." -ForegroundColor Cyan
    Push-Location $repoRoot
    try {
        & npx gitnexus analyze
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "[Deploy] GitNexus refresh failed, but production deployment is already healthy."
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  DEPLOY COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host "  Current Commit : $newHead" -ForegroundColor Cyan
Write-Host "  Source         : origin/main" -ForegroundColor Cyan
Write-Host "  Message        : da deploy" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
