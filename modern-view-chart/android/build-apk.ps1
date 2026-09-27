param(
    [string]$BuildType = "assembleDebug"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$javaCandidates = @(
    $env:JAVA_HOME,
    "C:\Program Files\Android\Android Studio\jbr"
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $javaCandidates) {
    throw "Java 17+ was not found. Set JAVA_HOME or install Android Studio."
}
$javaHome = $javaCandidates[0]

$androidSdkCandidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA "Android\Sdk")
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $androidSdkCandidates) {
    throw "Android SDK was not found. Set ANDROID_HOME/ANDROID_SDK_ROOT or install Android Studio."
}
$androidSdk = $androidSdkCandidates[0]

$localGradle = Join-Path $scriptDir "gradlew.bat"
if (Test-Path $localGradle) {
    $gradleCommand = $localGradle
} else {
    $gradle = Get-Command gradle.bat -ErrorAction SilentlyContinue
    if (-not $gradle) { $gradle = Get-Command gradle -ErrorAction SilentlyContinue }
    if (-not $gradle) {
        throw "Gradle was not found. Install Gradle or add a Gradle wrapper to android/."
    }
    $gradleCommand = $gradle.Source
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:Path = "$javaHome\bin;$env:Path"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   vivutrade Android APK Builder        " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Using Java:   $javaHome"
Write-Host "Using SDK:    $androidSdk"
Write-Host "Using Gradle: $gradleCommand"
Write-Host "Task:         $BuildType"
Write-Host ""

$tasks = $BuildType -split '\s+'
& $gradleCommand @tasks --warning-mode all --no-daemon

if ($LASTEXITCODE -ne 0) {
    throw "Gradle build failed with exit code $LASTEXITCODE"
}

$isRelease = $tasks -contains "assembleRelease"
$variant = if ($isRelease) { "release" } else { "debug" }
$fileName = if ($isRelease) { "app-release-unsigned.apk" } else { "app-debug.apk" }
$apkSource = Join-Path $scriptDir "app\build\outputs\apk\$variant\$fileName"

if (-not (Test-Path $apkSource)) {
    throw "Build succeeded but APK file was not found at: $apkSource"
}

$apkDest = Join-Path $scriptDir "vivutrade.apk"
Copy-Item -Path $apkSource -Destination $apkDest -Force

$legacyParentDest = "D:\TradingWeb\BE_ViewChart\vivutrade.apk"
if (Test-Path (Split-Path -Parent $legacyParentDest)) {
    Copy-Item -Path $apkSource -Destination $legacyParentDest -Force
}

$apkInfo = Get-Item $apkDest
$apkSizeMB = [math]::Round($apkInfo.Length / 1MB, 2)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "BUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host "APK output: $apkDest ($apkSizeMB MB)" -ForegroundColor Yellow
if ($isRelease) {
    Write-Warning "assembleRelease output is unsigned until a release signing configuration is provided."
}
Write-Host "========================================" -ForegroundColor Green
