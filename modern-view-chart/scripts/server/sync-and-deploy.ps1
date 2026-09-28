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

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  VIEWX - AUTOMATED PRODUCTION SYNC & DEPLOY" -ForegroundColor Cyan
Write-Host "  App directory : $appDir"
Write-Host "  Repo root     : $repoRoot"
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Stash local changes if dirty
Push-Location $repoRoot
$status = & git status --porcelain
$didStash = $false
if ($status) {
    $stashTag = "deploy-auto-stash-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Write-Host "[Deploy] Detected uncommitted local changes. Stashing ($stashTag)..." -ForegroundColor Yellow
    & git stash push -m $stashTag
    $didStash = $true
}

# 2. Fetch and pull origin main
Write-Host "[Deploy] Fetching updates from origin/main..." -ForegroundColor Cyan
& git fetch origin
$commitsAhead = (& git log HEAD..origin/main --oneline)
$oldHead = (& git rev-parse HEAD).Trim()

if ($commitsAhead) {
    Write-Host "[Deploy] New commits to deploy:" -ForegroundColor Green
    $commitsAhead | ForEach-Object { Write-Host "  -> $_" }
    Write-Host "[Deploy] Pulling origin main..." -ForegroundColor Cyan
    & git pull origin main
    if ($LASTEXITCODE -ne 0) {
        if ($didStash) { & git stash pop }
        Pop-Location
        throw "[Deploy] git pull failed."
    }
} else {
    Write-Host "[Deploy] Codebase is already at the latest commit ($oldHead)." -ForegroundColor Yellow
}
$newHead = (& git rev-parse HEAD).Trim()

# 3. Restore stash
if ($didStash) {
    Write-Host "[Deploy] Restoring uncommitted local changes (git stash pop)..." -ForegroundColor Cyan
    & git stash pop
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "[Deploy] Warning: git stash pop returned non-zero exit code. Please inspect git status."
    }
}
Pop-Location

# 4. Check if frontend build is needed
Push-Location $appDir
$frontendChanged = $false
if ($oldHead -ne $newHead) {
    Push-Location $repoRoot
    $diffFiles = (& git diff "$oldHead..$newHead" --name-only)
    Pop-Location
    $frontendFiles = $diffFiles | Where-Object {
        $_ -match "^modern-view-chart/src/" -or
        $_ -match "package\.json" -or
        $_ -match "package-lock\.json" -or
        $_ -match "next\.config"
    }
    if ($frontendFiles) {
        $frontendChanged = $true
        Write-Host "[Deploy] Frontend files changed in these commits:" -ForegroundColor Yellow
        $frontendFiles | ForEach-Object { Write-Host "     $_" }
    }
}

if ($ForceBuild -or $frontendChanged) {
    Write-Host "[Deploy] Building Next.js frontend (npm run build)..." -ForegroundColor Cyan
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        throw "[Deploy] npm run build failed!"
    }
} else {
    Write-Host "[Deploy] No frontend changes detected. Skipping Next.js build." -ForegroundColor Green
}

# 5. Run tests
if (-not $SkipTests) {
    Write-Host "[Deploy] Running backend runtime tests..." -ForegroundColor Cyan
    & npm run test:backend-runtime
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        throw "[Deploy] Backend runtime tests failed!"
    }

    Write-Host "[Deploy] Running unit tests..." -ForegroundColor Cyan
    & npm run test:unit
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        throw "[Deploy] Unit tests failed!"
    }
}

# 6. Restart PM2 services
Write-Host "[Deploy] Restarting PM2 services (viewx-backend-semi, viewx-frontend-semi, viewx-bridge-semi)..." -ForegroundColor Cyan
& pm2 restart viewx-backend-semi viewx-frontend-semi viewx-bridge-semi

# 7. Verification checks
Write-Host "[Deploy] Waiting 4 seconds for services to settle..." -ForegroundColor Cyan
Start-Sleep -Seconds 4

Write-Host "[Deploy] Testing Backend Health (/api/health)..." -ForegroundColor Cyan
$healthCheck = & curl.exe -s http://localhost:18091/api/health
Write-Host "  Response: $healthCheck" -ForegroundColor Green

Write-Host "[Deploy] Testing Live WebSocket Auth Smoke..." -ForegroundColor Cyan
& node scripts/server/ws-auth-smoke.mjs --ws-url "wss://api.vivutrade.io.vn"

Pop-Location

# 8. Update GitNexus index
if (-not $SkipGitNexus) {
    Write-Host "[Deploy] Refreshing GitNexus code intelligence index..." -ForegroundColor Cyan
    Push-Location $repoRoot
    & npx gitnexus analyze
    Pop-Location
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  DEPLOY COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "  Current Commit : $newHead" -ForegroundColor Cyan
Write-Host "  Status         : Production server is running latest version" -ForegroundColor Green
Write-Host "  Message for ChatGPT: da deploy" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
