param(
    [string]$RemoteName = "deploy",
    [string]$DeployBranch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$git = Get-Command "git" -ErrorAction SilentlyContinue
if ($null -eq $git) {
    throw "[push-deploy] Git CLI not found."
}

Write-Host "[push-deploy] Pushing current HEAD to $RemoteName/$DeployBranch"
& git push $RemoteName "HEAD:$DeployBranch"
if ($LASTEXITCODE -ne 0) {
    throw "[push-deploy] git push failed with exit code $LASTEXITCODE"
}

Write-Host "[push-deploy] Deploy push completed."
