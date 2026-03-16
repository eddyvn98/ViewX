param(
    [string]$BareRepoPath,
    [string]$RepoRoot,
    [string]$DeployBranch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $BareRepoPath) {
    throw "[deploy-from-git] Missing -BareRepoPath."
}

if (-not $RepoRoot) {
    throw "[deploy-from-git] Missing -RepoRoot."
}

$git = Get-Command "git" -ErrorAction SilentlyContinue
if ($null -eq $git) {
    throw "[deploy-from-git] Git CLI not found."
}

if (-not (Test-Path $BareRepoPath)) {
    throw "[deploy-from-git] Bare repo not found: $BareRepoPath"
}

if (-not (Test-Path $RepoRoot)) {
    throw "[deploy-from-git] Repo root not found: $RepoRoot"
}

$logsDir = Join-Path $RepoRoot "logs"
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
$logPath = Join-Path $logsDir "git-deploy.log"

function Write-DeployLog([string]$message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $message"
    Write-Host $line
    Add-Content -Path $logPath -Value $line
}

$dockerUpScript = Join-Path $RepoRoot "scripts\server\docker-up.ps1"
if (-not (Test-Path $dockerUpScript)) {
    throw "[deploy-from-git] Missing docker-up script: $dockerUpScript"
}

Write-DeployLog "Starting deploy for branch '$DeployBranch'."

$currentRevision = (& git --git-dir=$BareRepoPath rev-parse --verify "refs/heads/$DeployBranch" 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $currentRevision) {
    throw "[deploy-from-git] Branch '$DeployBranch' does not exist in bare repo."
}

Write-DeployLog "Checking out revision $currentRevision into work tree."
& git --git-dir=$BareRepoPath --work-tree=$RepoRoot checkout -f $DeployBranch
if ($LASTEXITCODE -ne 0) {
    throw "[deploy-from-git] git checkout failed with exit code $LASTEXITCODE"
}

Write-DeployLog "Running Docker deployment script."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $dockerUpScript
if ($LASTEXITCODE -ne 0) {
    throw "[deploy-from-git] docker-up.ps1 failed with exit code $LASTEXITCODE"
}

Write-DeployLog "Deploy completed successfully."
