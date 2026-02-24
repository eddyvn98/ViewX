param(
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvPath = Join-Path $RepoRoot ".env"
$LogsDir = Join-Path $RepoRoot "logs"
$LogPath = Join-Path $LogsDir "token-rotate.log"
$StatePath = Join-Path $LogsDir ".last-token-rotate"
$StopScript = Join-Path $PSScriptRoot "stop-all.ps1"
$RunAllScript = Join-Path $PSScriptRoot "run-all.ps1"

New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null

function Write-RotateLog([string]$message) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message"
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Get-EnvValue([string]$key) {
    if (-not (Test-Path $EnvPath)) { return "" }
    $line = Get-Content $EnvPath | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if (-not $line) { return "" }
    return $line.Split("=", 2)[1].Trim().Trim("'`"")
}

function Set-EnvValue([string]$key, [string]$value) {
    $lines = @()
    if (Test-Path $EnvPath) {
        $lines = Get-Content $EnvPath
    }

    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$key\s*=") {
            $lines[$i] = "$key=$value"
            $found = $true
        }
    }
    if (-not $found) {
        $lines += "$key=$value"
    }

    Set-Content -Path $EnvPath -Value $lines -Encoding ASCII
}

function New-AccessToken {
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Test-IsDueNow {
    if ($Force) { return $true }

    $rotateTime = Get-EnvValue "TOKEN_ROTATE_CRON_TIME"
    if (-not $rotateTime) { $rotateTime = "03:00" }

    $today = (Get-Date).ToString("yyyy-MM-dd")
    if (Test-Path $StatePath) {
        $last = (Get-Content $StatePath -ErrorAction SilentlyContinue | Select-Object -First 1)
        if ($last -eq $today) {
            return $false
        }
    }

    $now = Get-Date
    $parts = $rotateTime.Split(":")
    if ($parts.Count -ne 2) { return $true }
    $target = Get-Date -Hour ([int]$parts[0]) -Minute ([int]$parts[1]) -Second 0
    return $now -ge $target
}

if (-not (Test-Path $EnvPath)) {
    throw "[rotate-token] Missing .env file at $EnvPath"
}

if (-not (Test-IsDueNow)) {
    Write-RotateLog "[rotate-token] Skip: not due yet or already rotated today."
    exit 0
}

$backupPath = Join-Path $RepoRoot (".env.bak." + (Get-Date -Format "yyyyMMddHHmmss"))
Copy-Item -Path $EnvPath -Destination $backupPath -Force
Write-RotateLog "[rotate-token] Backed up .env -> $backupPath"

$newToken = New-AccessToken
Set-EnvValue -key "ACCESS_TOKEN" -value $newToken
Write-RotateLog "[rotate-token] ACCESS_TOKEN rotated."

if (-not (Test-Path $StopScript) -or -not (Test-Path $RunAllScript)) {
    throw "[rotate-token] Missing stop/run scripts."
}

& $StopScript | Out-Null
Start-Sleep -Seconds 2
& $RunAllScript | Out-Null

Start-Sleep -Seconds 12
$healthUrl = "http://127.0.0.1:8091/api/health?access_token=$newToken"
$ok = $false
try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 12
    $ok = $resp.StatusCode -eq 200
}
catch {
    $ok = $false
}

$mobileAccessPath = Join-Path $RepoRoot "public/mobile-access.json"
$containsToken = $false
if (Test-Path $mobileAccessPath) {
    $json = Get-Content $mobileAccessPath -Raw
    $containsToken = $json -like "*$newToken*"
}

if ($ok -and $containsToken) {
    Set-Content -Path $StatePath -Value (Get-Date -Format "yyyy-MM-dd") -Encoding ASCII
    Write-RotateLog "[rotate-token] Success: service healthy and mobile-access.json updated."
    exit 0
}

Write-RotateLog "[rotate-token] Warning: post-rotate verification failed (health=$ok, linkUpdated=$containsToken)."
exit 1
