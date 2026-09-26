param(
    [string]$BuildType = "assembleDebug"
)

$ErrorActionPreference = "Stop"

$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$androidSdk = "C:\Users\hatha\AppData\Local\Android\Sdk"
$gradleBat = "C:\Users\hatha\.gradle\wrapper\dists\gradle-8.13-bin\5xuhj0ry160q40clulazy9h7d\gradle-8.13\bin\gradle.bat"

if (-not (Test-Path $javaHome)) {
    Write-Error "Java JBR not found at: $javaHome"
    exit 1
}

if (-not (Test-Path $gradleBat)) {
    Write-Error "Gradle not found at: $gradleBat"
    exit 1
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidSdk
$env:Path = "$javaHome\bin;$env:Path"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   vivutrade Android APK Builder        " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Using Java: $javaHome"
Write-Host "Using SDK:  $androidSdk"
Write-Host "Task:       $BuildType"
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$tasks = $BuildType -split '\s+'
& $gradleBat @tasks --warning-mode all

if ($LASTEXITCODE -ne 0) {
    Write-Error "Gradle build failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

$apkSource = Join-Path $scriptDir "app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkSource) {
    $apkDest = Join-Path $scriptDir "vivutrade.apk"
    Copy-Item -Path $apkSource -Destination $apkDest -Force
    
    $parentDest = "D:\TradingWeb\BE_ViewChart\vivutrade.apk"
    Copy-Item -Path $apkSource -Destination $parentDest -Force

    $apkInfo = Get-Item $apkDest
    $apkSizeMB = [math]::Round($apkInfo.Length / 1MB, 2)

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "APK output:" -ForegroundColor Green
    Write-Host "  1. $apkDest ($apkSizeMB MB)" -ForegroundColor Yellow
    Write-Host "  2. $parentDest" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Warning "Build succeeded but APK file not found at: $apkSource"
}
