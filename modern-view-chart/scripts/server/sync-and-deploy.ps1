param(
    [switch]$ForceBuild = $false,
    [switch]$SkipTests = $false,
    [switch]$SkipGitNexus = $false,
    [switch]$SkipSoak = $false,
    [int]$SoakClients = 20,
    [int]$SoakDurationSec = 120,
    [int]$SoakRampSec = 20
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

    Write-Host "[Deploy] Waiting for backend to become healthy..." -ForegroundColor Cyan
    $backendHealthy = $false
    for ($i = 1; $i -le 15; $i++) {
        Start-Sleep -Seconds 2
        try {
            $healthResp = & curl.exe -fsS --max-time 3 http://localhost:18091/api/health 2>$null
            if ($LASTEXITCODE -eq 0 -and $healthResp -match '"status":\s*"ok"') {
                $backendHealthy = $true
                Write-Host "[Deploy] Backend is healthy after $($i * 2)s." -ForegroundColor Green
                break
            }
        } catch {}
        Write-Host "  -> Waiting for port 18091 ready ($($i)/15)..." -ForegroundColor Yellow
    }
    if (-not $backendHealthy) {
        throw "Backend health check failed after 30 seconds."
    }
    Write-Host ""

    Write-Host "[Deploy] Running live WebSocket auth smoke..." -ForegroundColor Cyan
    & node scripts/server/ws-auth-smoke.mjs --ws-url "wss://api.vivutrade.io.vn"
    Assert-LastExitCode "WebSocket auth smoke"

    if (-not $SkipSoak) {
        Write-Host "[Deploy] Running $SoakClients-client live soak test (${SoakDurationSec}s)..." -ForegroundColor Cyan
        & node scripts/server/ws-soak-test.mjs `
            --ws-url "wss://api.vivutrade.io.vn" `
            --api-url "https://api.vivutrade.io.vn" `
            --clients $SoakClients `
            --duration-sec $SoakDurationSec `
            --ramp-sec $SoakRampSec `
            --reconnect-attempts 3 `
            --reconnect-delay-ms 1000 `
            --require-metrics false `
            --output "logs/post-deploy-live-soak.json"
        Assert-LastExitCode "$SoakClients-client live soak"
    } else {
        Write-Warning "[Deploy] Post-deploy live soak skipped by -SkipSoak."
    }
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
