param (
    [string]$BridgeSource = "..\..\backend\bridge",
    [string]$DistPath = "..\bridge-dist",
    [string]$WorkPath = "..\bridge-build"
)
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedBridgeSource = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot $BridgeSource))
$resolvedDistPath = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot $DistPath))
$resolvedWorkPath = [System.IO.Path]::GetFullPath((Join-Path $scriptRoot $WorkPath))

$installerReq = Join-Path $resolvedBridgeSource "requirements-installer.txt"
$defaultReq = Join-Path $resolvedBridgeSource "requirements.txt"
$requirementsPath = if (Test-Path $installerReq) { $installerReq } else { $defaultReq }

if (-not (Test-Path $resolvedBridgeSource)) {
    throw "Bridge source not found: $resolvedBridgeSource"
}

if (-not (Test-Path $requirementsPath)) {
    throw "Bridge requirements not found: $requirementsPath"
}

Write-Host "==============================================="
Write-Host "   COMPILING MT5 BRIDGE WITH PYINSTALLER       "
Write-Host "==============================================="

# 1. Ensure pip and pyinstaller
Write-Host "[1/3] Ensuring PyInstaller is installed..."
python -m pip install --upgrade pip
python -m pip install pyinstaller

# 2. Install requirements so PyInstaller sees them
Write-Host "[2/3] Installing bridge requirements into global/venv..."
python -m pip install -r $requirementsPath

# 3. Build executable
Write-Host "[3/3] Compiling main.py to mt5_bridge.exe..."
# --noconfirm: overwrite existing
# --onefile: bundle everything into a single .exe
# --console: hide console? No, --noconsole hides it. But for debugging we might want console, or we can use --noconsole to hide it from popping up.
# Actually node spawn with `windowsHide: true` hides the console anyway, but --noconsole is safer to avoid any flashing windows.
# We will use --noconsole just to be extremely clean.
pyinstaller --noconfirm --onefile --noconsole `
    --name mt5_bridge `
    --distpath $resolvedDistPath `
    --workpath $resolvedWorkPath `
    --specpath $resolvedBridgeSource `
    --paths (Join-Path $resolvedBridgeSource "src") `
    --hidden-import MetaTrader5 `
    --hidden-import numpy `
    --hidden-import websockets `
    --hidden-import requests `
    --hidden-import charset_normalizer `
    --collect-all numpy `
    --collect-all MetaTrader5 `
    --collect-submodules websockets `
    --collect-data charset_normalizer `
    --collect-data certifi `
    (Join-Path $resolvedBridgeSource "main.py")

Write-Host "Done! Executable is at: $resolvedDistPath\mt5_bridge.exe"
