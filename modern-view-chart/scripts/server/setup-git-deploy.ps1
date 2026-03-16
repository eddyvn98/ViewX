param(
    [string]$BareRepoPath = "D:\git-remotes\modern-view-chart.git",
    [string]$DeployBranch = "main",
    [string]$RepoRoot = "",
    [switch]$SkipHook
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}

$git = Get-Command "git" -ErrorAction SilentlyContinue
if ($null -eq $git) {
    throw "[setup-git-deploy] Git CLI not found. Install Git first."
}

if (-not (Test-Path $RepoRoot)) {
    throw "[setup-git-deploy] Repo root not found: $RepoRoot"
}

$hooksDir = Join-Path $BareRepoPath "hooks"
$postReceiveHook = Join-Path $hooksDir "post-receive"
$deployScript = Join-Path $RepoRoot "scripts\server\deploy-from-git.ps1"

if (-not (Test-Path $BareRepoPath)) {
    New-Item -ItemType Directory -Path $BareRepoPath -Force | Out-Null
    & git init --bare $BareRepoPath
    if ($LASTEXITCODE -ne 0) {
        throw "[setup-git-deploy] git init --bare failed with exit code $LASTEXITCODE"
    }
    Write-Host "[setup-git-deploy] Created bare repo at $BareRepoPath"
}
else {
    Write-Host "[setup-git-deploy] Bare repo already exists at $BareRepoPath"
}

if (-not $SkipHook) {
    New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null

    $hookContent = @(
        "#!/bin/sh",
        "deploy_branch=""refs/heads/$DeployBranch""",
        "while read oldrev newrev refname",
        "do",
        "  if [ ""`$refname"" = ""`$deploy_branch"" ]; then",
        "    powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$deployScript`" -BareRepoPath `"$BareRepoPath`" -RepoRoot `"$RepoRoot`" -DeployBranch `"$DeployBranch`"",
        "    exit `$?",
        "  fi",
        "done",
        "exit 0"
    )
    Set-Content -Path $postReceiveHook -Value $hookContent -Encoding ascii

    Write-Host "[setup-git-deploy] Wrote hook: $postReceiveHook"
}

$remotePath = $BareRepoPath -replace "\\", "/"

Write-Host ""
Write-Host "[setup-git-deploy] Setup complete."
Write-Host "[setup-git-deploy] From the coding machine, add this remote:"
Write-Host "  git remote add deploy ssh://<deploy-user>@<deploy-host>/$remotePath"
Write-Host "[setup-git-deploy] Then deploy with:"
Write-Host "  git push deploy $DeployBranch"
Write-Host ""
Write-Host "[setup-git-deploy] Requirements on deploy machine:"
Write-Host "  - Docker Desktop / Docker Engine is running"
Write-Host "  - .env.docker exists in $RepoRoot"
Write-Host "  - The deploy user can access this repo path and run Docker"
