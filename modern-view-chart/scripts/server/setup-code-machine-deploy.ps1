param(
    [Parameter(Mandatory = $true)]
    [string]$DeployHost,
    [Parameter(Mandatory = $true)]
    [string]$DeployUser,
    [string]$DeployRemotePath = "D:/git-remotes/modern-view-chart.git",
    [string]$RemoteName = "deploy",
    [string]$DeployBranch = "main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$git = Get-Command "git" -ErrorAction SilentlyContinue
if ($null -eq $git) {
    throw "[setup-code-machine-deploy] Git CLI not found."
}

$remoteUrl = "ssh://$DeployUser@$DeployHost/$DeployRemotePath"
$existingRemote = (& git remote)
if ($LASTEXITCODE -ne 0) {
    throw "[setup-code-machine-deploy] Unable to list git remotes."
}

if ($existingRemote -contains $RemoteName) {
    & git remote set-url $RemoteName $remoteUrl
    if ($LASTEXITCODE -ne 0) {
        throw "[setup-code-machine-deploy] Failed to update remote '$RemoteName'."
    }
    Write-Host "[setup-code-machine-deploy] Updated remote '$RemoteName' -> $remoteUrl"
}
else {
    & git remote add $RemoteName $remoteUrl
    if ($LASTEXITCODE -ne 0) {
        throw "[setup-code-machine-deploy] Failed to add remote '$RemoteName'."
    }
    Write-Host "[setup-code-machine-deploy] Added remote '$RemoteName' -> $remoteUrl"
}

& git config alias.ship "push $RemoteName HEAD:$DeployBranch"
if ($LASTEXITCODE -ne 0) {
    throw "[setup-code-machine-deploy] Failed to configure alias 'ship'."
}

Write-Host "[setup-code-machine-deploy] Configured git alias:"
Write-Host "  git ship"
Write-Host "[setup-code-machine-deploy] This will push current HEAD to $RemoteName/$DeployBranch."
