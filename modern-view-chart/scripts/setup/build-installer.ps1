param(
    [string]$InnoCompilerPath = "",
    [string]$OutputDir = "public\downloads",
    [string]$PayloadDir = "public\downloads\installer",
    [ValidateSet("desktop-full", "web-extension", "hybrid")]
    [string]$InstallMode = "desktop-full",
    [string]$ExtensionId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    [string]$ExtensionUpdateUrl = "http://localhost:3000/downloads/chrome-extension/update.xml",
    [string]$AccessToken = "",
    [string]$NodeWsUrl = "ws://127.0.0.1:8091"
)

$ErrorActionPreference = "Stop"

function Resolve-InnoCompiler([string]$candidate) {
    if ($candidate -and (Test-Path $candidate)) { return (Resolve-Path $candidate).Path }

    $common = @(
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
    )
    foreach ($path in $common) {
        if (Test-Path $path) { return $path }
    }

    $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$issFile = Join-Path $PSScriptRoot "vivutrade-pro-installer.iss"
$compiler = Resolve-InnoCompiler $InnoCompilerPath
if (-not $compiler) {
    throw "Inno Setup compiler not found. Install Inno Setup 6 and retry."
}
if (-not (Test-Path $issFile)) {
    throw "Missing ISS file: $issFile"
}

$outputAbs = Join-Path $repoRoot $OutputDir
$payloadAbs = Join-Path $repoRoot $PayloadDir
if (-not (Test-Path $payloadAbs)) {
    throw "Missing payload folder: $payloadAbs"
}
New-Item -ItemType Directory -Path $outputAbs -Force | Out-Null

Write-Host "[installer] Compiler : $compiler"
Write-Host "[installer] ISS      : $issFile"
Write-Host "[installer] Payload  : $payloadAbs"
Write-Host "[installer] Output   : $outputAbs"

& $compiler `
    "/DRepoRoot=$repoRoot" `
    "/DPayloadDir=$payloadAbs" `
    "/DOutputDir=$outputAbs" `
    "/DInstallMode=$InstallMode" `
    "/DExtensionId=$ExtensionId" `
    "/DExtensionUpdateUrl=$ExtensionUpdateUrl" `
    "/DAccessToken=$AccessToken" `
    "/DNodeWsUrl=$NodeWsUrl" `
    $issFile

if ($LASTEXITCODE -ne 0) {
    throw "ISCC failed with code $LASTEXITCODE"
}

Write-Host "[installer] Build complete: $(Join-Path $outputAbs 'Vivutrade-Desktop-Full-Installer.exe')"
