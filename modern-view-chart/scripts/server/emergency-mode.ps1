param(
    [switch]$Enable,
    [switch]$Disable,
    [switch]$Status,
    [switch]$NoRestart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvPath = Join-Path $RepoRoot ".env"
$RunAllScript = Join-Path $PSScriptRoot "run-all.ps1"
$StopScript = Join-Path $PSScriptRoot "stop-all.ps1"

function Get-EnvValue([string]$key) {
    if (-not (Test-Path $EnvPath)) { return "" }
    $line = Get-Content $EnvPath | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if (-not $line) { return "" }
    return $line.Split("=", 2)[1].Trim().Trim("'`"")
}

function Set-EnvValue([string]$key, [string]$value) {
    $lines = @()
    if (Test-Path $EnvPath) { $lines = Get-Content $EnvPath }

    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$key\s*=") {
            $lines[$i] = "$key=$value"
            $found = $true
        }
    }
    if (-not $found) { $lines += "$key=$value" }
    Set-Content -Path $EnvPath -Value $lines -Encoding ASCII
}

function Show-Status {
    $keys = @(
        "EMERGENCY_MODE",
        "EMERGENCY_BLOCK_HEAVY_HTTP",
        "EMERGENCY_BLOCK_TRADING",
        "EMERGENCY_API_LIMIT_PER_MIN",
        "EMERGENCY_AI_LIMIT_PER_MIN",
        "EMERGENCY_AI_TASK_LIMIT_PER_MIN",
        "EMERGENCY_MARKET_LIMIT_PER_MIN",
        "EMERGENCY_MAX_WS_CLIENTS",
        "EMERGENCY_WS_MSG_RATE_PER_10S",
        "EMERGENCY_BRIDGE_WS_MSG_RATE_PER_10S",
        "EMERGENCY_WS_BROADCAST_INTERVAL_MS",
        "EMERGENCY_BINANCE_BROADCAST_INTERVAL_MS"
    )

    Write-Host "[emergency-mode] Current settings:"
    foreach ($key in $keys) {
        $value = Get-EnvValue $key
        if (-not $value) { $value = "<unset>" }
        Write-Host ("  " + $key + "=" + $value)
    }
}

if (-not (Test-Path $EnvPath)) {
    throw "[emergency-mode] Missing .env file at $EnvPath"
}

if ($Status -or (-not $Enable -and -not $Disable)) {
    Show-Status
    if (-not $Enable -and -not $Disable) { exit 0 }
}

if ($Enable -and $Disable) {
    throw "[emergency-mode] Use either -Enable or -Disable."
}

if ($Enable) {
    Set-EnvValue "EMERGENCY_MODE" "1"
    Set-EnvValue "EMERGENCY_BLOCK_HEAVY_HTTP" "1"
    Set-EnvValue "EMERGENCY_BLOCK_TRADING" "1"
    Write-Host "[emergency-mode] EMERGENCY_MODE enabled."
}

if ($Disable) {
    Set-EnvValue "EMERGENCY_MODE" "0"
    Write-Host "[emergency-mode] EMERGENCY_MODE disabled."
}

if (-not $NoRestart) {
    if (-not (Test-Path $StopScript) -or -not (Test-Path $RunAllScript)) {
        throw "[emergency-mode] Missing stop/run scripts."
    }
    Write-Host "[emergency-mode] Restarting services..."
    & $StopScript | Out-Null
    Start-Sleep -Seconds 2
    & $RunAllScript | Out-Null
}

Show-Status

