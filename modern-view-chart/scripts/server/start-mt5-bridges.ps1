param(
    [string]$Config = "scripts/server/mt5-bridges.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Config)) {
    Write-Host "[ERROR] Config not found: $Config" -ForegroundColor Red
    Write-Host "Copy scripts/server/mt5-bridges.example.json to scripts/server/mt5-bridges.json and update mt5Path."
    exit 1
}

$python = Get-Command python -ErrorAction Stop
$instances = Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json

if (-not $instances -or $instances.Count -eq 0) {
    Write-Host "[ERROR] No bridge instances in $Config" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Starting $($instances.Count) MT5 bridge instance(s)..."

foreach ($instance in $instances) {
    $name = [string]$instance.name
    $mt5Path = [string]$instance.mt5Path

    if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($mt5Path)) {
        Write-Host "[WARN] Skipping invalid item (missing name or mt5Path)." -ForegroundColor Yellow
        continue
    }

    if (-not (Test-Path -LiteralPath $mt5Path)) {
        Write-Host "[WARN] MT5 path not found for '$name': $mt5Path" -ForegroundColor Yellow
        continue
    }

    $argList = @("backend/bridge/main.py", "--name", $name, "--path", $mt5Path)

    Start-Process -FilePath $python.Source -ArgumentList $argList -WorkingDirectory (Get-Location) -WindowStyle Normal
    Write-Host "[OK] Launched bridge '$name' with $mt5Path"
}

Write-Host "[DONE] Bridge launch command completed."
