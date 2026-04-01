param(
    [switch]$SkipPythonDeps,
    [ValidateSet('chrome', 'edge', 'both')]
    [string]$Browser,
    [ValidateSet('desktop-full', 'web-extension', 'hybrid')]
    [string]$InstallMode = "desktop-full",
    [string]$ExtensionId = "",
    [string]$ExtensionUpdateUrl = "",
    [string]$AccessToken = "",
    [string]$NodeWsUrl = ""
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) {
    Write-Host "[SETUP] $msg" -ForegroundColor Cyan
}

function Resolve-BrowserChoice {
    param([string]$InputChoice)

    if ($InputChoice) { return $InputChoice.ToLowerInvariant() }

    Write-Host ''
    Write-Host 'Chon trinh duyet de cai extension:' -ForegroundColor Yellow
    Write-Host '1) Chrome'
    Write-Host '2) Edge'
    Write-Host '3) Ca hai'
    $choice = Read-Host 'Nhap 1, 2 hoac 3 (mac dinh: 1)'
    switch ($choice) {
        '2' { return 'edge' }
        '3' { return 'both' }
        default { return 'chrome' }
    }
}

function Resolve-PythonExe {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) { return $python.Source }
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) { return "$($py.Source) -3" }
    return $null
}

function Find-BrowserExe {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('chrome', 'edge')]
        [string]$Browser
    )

    if ($Browser -eq 'chrome') {
        $candidates = @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
            "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        )
    } else {
        $candidates = @(
            "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
            "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
            "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
        )
    }

    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }

    return $null
}

function Stop-BrowserIfRunning {
    param([string]$browserChoice)
    $targets = if ($browserChoice -eq 'both') { @('chrome', 'edge') } else { @($browserChoice) }
    foreach ($target in $targets) {
        $processName = if ($target -eq 'edge') { 'msedge' } else { 'chrome' }
        $running = Get-Process -Name $processName -ErrorAction SilentlyContinue
        if ($running) {
            Write-Step "Closing $processName to apply extension policy"
            $running | Stop-Process -Force -ErrorAction SilentlyContinue
        }
    }
}

function Open-BrowserHome {
    param(
        [string]$browserChoice,
        [string]$launchUrl = "about:blank"
    )
    $targets = if ($browserChoice -eq 'both') { @('chrome', 'edge') } else { @($browserChoice) }
    foreach ($target in $targets) {
        $exe = Find-BrowserExe -Browser $target
        if ($exe) {
            Write-Step "Launching $target to pick up policy-installed extension"
            Start-Process -FilePath $exe -ArgumentList $launchUrl | Out-Null
        }
    }
}

function Resolve-DesktopUrl {
    param(
        [string]$explicitValue,
        [string]$envName,
        [string]$fallback
    )

    if ($explicitValue -and $explicitValue.Trim()) {
        return $explicitValue.Trim()
    }

    $fromEnv = [System.Environment]::GetEnvironmentVariable($envName)
    if ($fromEnv -and $fromEnv.Trim()) {
        return $fromEnv.Trim()
    }

    return $fallback
}

function Resolve-EnvValue {
    param(
        [string]$explicitValue,
        [string[]]$envNames,
        [string]$fallback
    )

    if ($explicitValue -and $explicitValue.Trim()) { return $explicitValue.Trim() }
    foreach ($name in $envNames) {
        $v = [System.Environment]::GetEnvironmentVariable($name)
        if ($v -and $v.Trim()) { return $v.Trim() }
    }
    return $fallback
}

function Write-BridgeEnvFile {
    param(
        [string]$bridgeDir,
        [string]$accessToken,
        [string]$nodeWsUrl
    )

    $assetsDir = Split-Path -Parent $bridgeDir
    $envPath = Join-Path $assetsDir ".env"
    $content = @"
ACCESS_TOKEN=$accessToken
NODE_WS_URL=$nodeWsUrl
BRIDGE_CLIENT_MODE=service_bridge
"@
    Set-Content -Path $envPath -Value $content -Encoding ASCII
    Write-Step "Bridge env written: $envPath"
    return $envPath
}

function Write-DesktopLauncher {
    param(
        [string]$binPath,
        [string]$bridgeMainPath,
        [string]$bridgePythonPath,
        [string]$bridgeLogPath,
        [string]$webUrl,
        [string]$guideUrl,
        [string]$pricingUrl
    )

    $ps1Path = Join-Path $binPath "Start-Vivutrade-Desktop.ps1"
    $cmdPath = Join-Path $binPath "Start-Vivutrade-Desktop.cmd"
    $template = @'
param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$mutexName = 'Global\VivutradeDesktopTrayMutex'
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
    exit 0
}

$BridgeMain = '__BRIDGE_MAIN__'
$BridgePython = '__BRIDGE_PYTHON__'
$BridgeLogDir = '__BRIDGE_LOG_DIR__'
$WebUrl = '__WEB_URL__'
$GuideUrl = '__GUIDE_URL__'
$PricingUrl = '__PRICING_URL__'

$script:BridgeProcess = $null
$script:NotifyIcon = $null
$script:StatusTimer = $null

function Write-DesktopLog([string]$message) {
    try {
        New-Item -ItemType Directory -Path $BridgeLogDir -Force | Out-Null
        $line = '[{0}] {1}' -f (Get-Date).ToString('s'), $message
        Add-Content -Path (Join-Path $BridgeLogDir 'desktop-tray.log') -Value $line -Encoding ASCII
    } catch {
        # Tray logging must never break the launcher.
    }
}

function Open-DesktopUrl([string]$url) {
    if (-not $url) { return }
    try {
        Start-Process -FilePath $url | Out-Null
    } catch {
        Write-DesktopLog ("open_url_failed: " + $_.Exception.Message)
    }
}

function Update-StatusText {
    $state = 'Bridge offline'
    if ($script:BridgeProcess -and -not $script:BridgeProcess.HasExited) {
        $state = 'Bridge running'
    }
    if ($script:NotifyIcon) {
        $script:NotifyIcon.Text = "Vivutrade Desktop - $state"
    }
}

function Stop-Bridge {
    if ($script:BridgeProcess -and -not $script:BridgeProcess.HasExited) {
        try {
            Stop-Process -Id $script:BridgeProcess.Id -Force -ErrorAction SilentlyContinue
        } catch {
            Write-DesktopLog ("bridge_stop_failed: " + $_.Exception.Message)
        }
    }
    $script:BridgeProcess = $null
    Update-StatusText
}

function Start-Bridge {
    if ($script:BridgeProcess -and -not $script:BridgeProcess.HasExited) {
        return $script:BridgeProcess
    }

    if (-not (Test-Path $BridgeMain)) {
        Write-DesktopLog 'bridge_main_missing'
        Update-StatusText
        return $null
    }

    New-Item -ItemType Directory -Path $BridgeLogDir -Force | Out-Null
    $stdout = Join-Path $BridgeLogDir 'bridge-desktop.out.log'
    $stderr = Join-Path $BridgeLogDir 'bridge-desktop.err.log'
    $cwd = Split-Path -Parent $BridgeMain

    try {
        if (Test-Path $BridgePython) {
            $script:BridgeProcess = Start-Process -FilePath $BridgePython -ArgumentList @('-u', $BridgeMain) -WorkingDirectory $cwd -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
        } else {
            $script:BridgeProcess = Start-Process -FilePath 'python' -ArgumentList @('-u', $BridgeMain) -WorkingDirectory $cwd -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
        }
        Write-DesktopLog ("bridge_started pid=" + $script:BridgeProcess.Id)
    } catch {
        $script:BridgeProcess = $null
        Write-DesktopLog ("bridge_start_failed: " + $_.Exception.Message)
    }

    Update-StatusText
    return $script:BridgeProcess
}

function Start-BridgeMonitor {
    if ($script:StatusTimer) { return }

    $script:StatusTimer = New-Object System.Windows.Forms.Timer
    $script:StatusTimer.Interval = 10000
    $script:StatusTimer.Add_Tick({
        if ($script:BridgeProcess -and -not $script:BridgeProcess.HasExited) {
            Update-StatusText
            return
        }

        Write-DesktopLog 'bridge_not_running_restart'
        Start-Bridge | Out-Null
    })
    $script:StatusTimer.Start()
}

function New-MenuItem {
    param(
        [string]$text,
        [scriptblock]$action
    )

    $item = New-Object System.Windows.Forms.ToolStripMenuItem($text)
    if ($action) {
        $item.Add_Click({ & $action })
    }
    return $item
}

function Build-Menu {
    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    [void]$menu.Items.Add((New-MenuItem -text 'Mo Vivutrade' -action { Open-DesktopUrl $WebUrl }))
    [void]$menu.Items.Add((New-MenuItem -text 'Mo huong dan kich hoat' -action { Open-DesktopUrl $GuideUrl }))
    [void]$menu.Items.Add((New-MenuItem -text 'Mo bang gia' -action { Open-DesktopUrl $PricingUrl }))
    [void]$menu.Items.Add((New-MenuItem -text 'Mo thu muc log' -action { Start-Process -FilePath 'explorer.exe' -ArgumentList $BridgeLogDir | Out-Null }))
    [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    [void]$menu.Items.Add((New-MenuItem -text 'Khoi dong lai bridge' -action {
        Stop-Bridge
        Start-Bridge | Out-Null
    }))
    [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    [void]$menu.Items.Add((New-MenuItem -text 'Thoat' -action {
        try {
            Stop-Bridge
            if ($script:StatusTimer) { $script:StatusTimer.Stop() }
            if ($script:NotifyIcon) {
                $script:NotifyIcon.Visible = $false
                $script:NotifyIcon.Dispose()
            }
        } finally {
            [System.Windows.Forms.Application]::Exit()
        }
    }))
    return $menu
}

$script:NotifyIcon = New-Object System.Windows.Forms.NotifyIcon
$script:NotifyIcon.Icon = [System.Drawing.SystemIcons]::Application
$script:NotifyIcon.Text = 'Vivutrade Desktop'
$script:NotifyIcon.Visible = $true
$script:NotifyIcon.ContextMenuStrip = Build-Menu
Update-StatusText

$form = New-Object System.Windows.Forms.Form
$form.ShowInTaskbar = $false
$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedToolWindow
$form.Opacity = 0
$form.Add_Shown({ $form.Hide() })
$form.Add_Load({
    Start-Bridge | Out-Null
    Start-BridgeMonitor
})
$form.Add_FormClosing({
    Stop-Bridge
    if ($script:StatusTimer) {
        $script:StatusTimer.Stop()
    }
    if ($script:NotifyIcon) {
        $script:NotifyIcon.Visible = $false
        $script:NotifyIcon.Dispose()
    }
})

try {
    [System.Windows.Forms.Application]::Run($form)
} finally {
    if ($mutex) {
        $mutex.ReleaseMutex() | Out-Null
        $mutex.Dispose()
    }
}
'@

    $content = $template.
        Replace('__BRIDGE_MAIN__', $bridgeMainPath).
        Replace('__BRIDGE_PYTHON__', $bridgePythonPath).
        Replace('__BRIDGE_LOG_DIR__', $bridgeLogPath).
        Replace('__WEB_URL__', $webUrl).
        Replace('__GUIDE_URL__', $guideUrl).
        Replace('__PRICING_URL__', $pricingUrl)

    Set-Content -Path $ps1Path -Value $content -Encoding ASCII

    $cmdContent = @"
@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Start-Vivutrade-Desktop.ps1"
endlocal
"@
    Set-Content -Path $cmdPath -Value $cmdContent -Encoding ASCII

    return [pscustomobject]@{
        Ps1Path = $ps1Path
        CmdPath = $cmdPath
    }
}

function Install-StartupShortcut {
    param(
        [string]$targetPath,
        [string]$arguments,
        [string]$workingDirectory
    )

    $startupFolder = [Environment]::GetFolderPath("Startup")
    if (-not $startupFolder) { return $null }

    $shortcutPath = Join-Path $startupFolder "Vivutrade Desktop.lnk"
    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $targetPath
        $shortcut.Arguments = $arguments
        $shortcut.WorkingDirectory = $workingDirectory
        $shortcut.IconLocation = "$env:SystemRoot\System32\SHELL32.dll, 21"
        $shortcut.Save()
        Write-Step "Startup shortcut created: $shortcutPath"
        return $shortcutPath
    } catch {
        Write-Warning "Failed to create startup shortcut: $($_.Exception.Message)"
        return $null
    }
}

function Set-ExtensionPolicy {
    param(
        [string]$browserChoice,
        [string]$extensionId,
        [string]$updateUrl
    )
    $targets = if ($browserChoice -eq 'both') { @('chrome', 'edge') } else { @($browserChoice) }
    foreach ($target in $targets) {
        $policySet = $false
        try {
            if ($target -eq 'edge') {
                $policyBase = 'HKCU:\Software\Policies\Microsoft\Edge'
            } else {
                $policyBase = 'HKCU:\Software\Policies\Google\Chrome'
            }
            $forcelist = Join-Path $policyBase 'ExtensionInstallForcelist'
            New-Item -Path $forcelist -Force | Out-Null
            New-ItemProperty -Path $forcelist -Name '1' -Value "$extensionId;$updateUrl" -PropertyType String -Force | Out-Null
            Write-Step "Policy set for ${target}: $extensionId via $updateUrl"
            $policySet = $true
        } catch {
            Write-Warning "Cannot write policy key for $target. Falling back to per-user extension registry."
        }

        if (-not $policySet) {
            try {
                if ($target -eq 'edge') {
                    $legacyBase = "HKCU:\Software\Microsoft\Edge\Extensions\$extensionId"
                } else {
                    $legacyBase = "HKCU:\Software\Google\Chrome\Extensions\$extensionId"
                }
                New-Item -Path $legacyBase -Force -ErrorAction Stop | Out-Null
                New-ItemProperty -Path $legacyBase -Name 'update_url' -Value $updateUrl -PropertyType String -Force -ErrorAction Stop | Out-Null
                Write-Step "Legacy extension registry set for ${target}: $extensionId via $updateUrl"
            } catch {
                Write-Error "Failed to set legacy extension registry for ${target}: $($_.Exception.Message)"
                throw
            }
        }
    }
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallerRoot = Resolve-Path (Join-Path $ScriptDir '..')
$RepoRoot = Resolve-Path (Join-Path $ScriptDir '..\\..')

$packagedBridgeMain = Join-Path $InstallerRoot 'assets\\bridge\\main.py'
$packagedBridgeReq = Join-Path $InstallerRoot 'assets\\bridge\\requirements.txt'
$packagedBridgeReqInstaller = Join-Path $InstallerRoot 'assets\\bridge\\requirements-installer.txt'
if (Test-Path $packagedBridgeMain) {
    $bridgeMain = $packagedBridgeMain
    if (Test-Path $packagedBridgeReqInstaller) {
        $bridgeReq = $packagedBridgeReqInstaller
    } else {
        $bridgeReq = $packagedBridgeReq
    }
    $workingRoot = Split-Path -Parent $bridgeMain
} else {
    $bridgeMain = Join-Path $RepoRoot 'backend\\bridge\\main.py'
    $bridgeReq = Join-Path $RepoRoot 'backend\\bridge\\requirements.txt'
    $workingRoot = $RepoRoot
}

if (-not (Test-Path $bridgeMain)) { throw "Missing bridge entry: $bridgeMain" }

Set-Location $workingRoot

$installRoot = Join-Path $env:LOCALAPPDATA 'VivutradePro'
$binDir = Join-Path $installRoot 'bin'
$venvDir = Join-Path $installRoot 'bridge-venv'
New-Item -ItemType Directory -Force $binDir | Out-Null
$browserChoice = Resolve-BrowserChoice -InputChoice $Browser
$logDir = Join-Path $installRoot 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$setupLog = Join-Path $logDir 'setup.log'
Start-Transcript -Path $setupLog -Force | Out-Null

$extensionRequired = $InstallMode -eq 'web-extension' -or $InstallMode -eq 'hybrid'
$resolvedExtensionId = if ($ExtensionId) { $ExtensionId } elseif ($env:VIVUTRADE_EXTENSION_ID) { $env:VIVUTRADE_EXTENSION_ID } else { '' }
$resolvedUpdateUrl = if ($ExtensionUpdateUrl) { $ExtensionUpdateUrl } elseif ($env:VIVUTRADE_EXTENSION_UPDATE_URL) { $env:VIVUTRADE_EXTENSION_UPDATE_URL } else { '' }
if ($extensionRequired -and (-not $resolvedExtensionId -or -not $resolvedUpdateUrl)) {
    throw 'Missing extension policy config. Provide -ExtensionId and -ExtensionUpdateUrl (or env VIVUTRADE_EXTENSION_ID / VIVUTRADE_EXTENSION_UPDATE_URL).'
}

$venvPython = Join-Path $venvDir 'Scripts\\python.exe'
$desktopWebUrl = Resolve-DesktopUrl "" "VIVUTRADE_DESKTOP_WEB_URL" "https://vivutrade.io.vn/vi/chart"
$desktopGuideUrl = Resolve-DesktopUrl "" "VIVUTRADE_DESKTOP_GUIDE_URL" "https://vivutrade.io.vn/vi/guides/terminal-setup"
$desktopPricingUrl = Resolve-DesktopUrl "" "VIVUTRADE_DESKTOP_PRICING_URL" "https://vivutrade.io.vn/vi/pricing"
$resolvedAccessToken = Resolve-EnvValue -explicitValue $AccessToken -envNames @("VIVUTRADE_ACCESS_TOKEN", "ACCESS_TOKEN") -fallback ""
$resolvedNodeWsUrl = Resolve-EnvValue -explicitValue $NodeWsUrl -envNames @("VIVUTRADE_NODE_WS_URL", "NODE_WS_URL") -fallback "ws://127.0.0.1:8091"
if (-not $resolvedAccessToken) {
    throw "Missing service ACCESS_TOKEN for bridge websocket auth. Provide -AccessToken or env VIVUTRADE_ACCESS_TOKEN/ACCESS_TOKEN."
}

if (-not $SkipPythonDeps) {
    $pythonExec = Resolve-PythonExe
    if (-not $pythonExec) {
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if (-not $winget) {
            throw 'Python is missing and winget is unavailable. Install Python 3.11+ then re-run setup.'
        }

        Write-Step 'Python not found. Installing Python 3.11 via winget...'
        & winget install -e --id Python.Python.3.11 --accept-package-agreements --accept-source-agreements
        $pythonExec = Resolve-PythonExe
        if (-not $pythonExec) {
            throw 'Auto-install Python failed. Please install Python 3.11+ and run setup again.'
        }
    }

    if (-not (Test-Path $venvPython)) {
        Write-Step 'Creating portable bridge venv under %LOCALAPPDATA%\\VivutradePro'
        if ($pythonExec -like '* -3') {
            & py -3 -m venv $venvDir
        } else {
            & $pythonExec -m venv $venvDir
        }
    } else {
        Write-Step 'Reusing existing portable bridge venv'
    }

    if (-not (Test-Path $venvPython)) {
        throw "Venv python not found: $venvPython"
    }

    Write-Step 'Installing bridge dependencies into portable venv'
    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -r $bridgeReq
}

$bridgeDir = Split-Path -Parent $bridgeMain
$bridgeEnvPath = Write-BridgeEnvFile -bridgeDir $bridgeDir -accessToken $resolvedAccessToken -nodeWsUrl $resolvedNodeWsUrl
$startBridgeCmd = Join-Path $binDir 'Start-Vivutrade-Bridge.cmd'
$cmdContent = @"
@echo off
setlocal
cd /d "$bridgeDir"
if exist "$venvDir\\Scripts\\python.exe" (
  "$venvDir\\Scripts\\python.exe" main.py
) else (
  python main.py
)
endlocal
"@
Set-Content -Path $startBridgeCmd -Value $cmdContent -Encoding ASCII

$desktopLauncher = Write-DesktopLauncher -binPath $binDir -bridgeMainPath $bridgeMain -bridgePythonPath $venvPython -bridgeLogPath $logDir -webUrl $desktopWebUrl -guideUrl $desktopGuideUrl -pricingUrl $desktopPricingUrl
$startupShortcut = Install-StartupShortcut -targetPath (Get-Command powershell.exe).Source -arguments "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$($desktopLauncher.Ps1Path)`"" -workingDirectory $binDir

if ($extensionRequired) {
    Write-Step 'Applying browser extension policy for auto-install'
    Stop-BrowserIfRunning -browserChoice $browserChoice
    Set-ExtensionPolicy -browserChoice $browserChoice -extensionId $resolvedExtensionId -updateUrl $resolvedUpdateUrl
} else {
    Write-Step 'Desktop-full mode: skip extension policy setup'
}
Start-Process -FilePath (Get-Command powershell.exe).Source -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", $desktopLauncher.Ps1Path) | Out-Null
Open-BrowserHome -browserChoice $browserChoice -launchUrl $desktopWebUrl

Write-Host ''
Write-Host '========== SETUP COMPLETE ==========' -ForegroundColor Green
Write-Host "Install mode:     $InstallMode"
if ($extensionRequired) {
    Write-Host "Extension policy: $resolvedExtensionId"
    Write-Host "Update URL:       $resolvedUpdateUrl"
}
Write-Host "Bridge runner:    $startBridgeCmd"
Write-Host "Desktop launcher: $($desktopLauncher.CmdPath)"
Write-Host "Bridge env:       $bridgeEnvPath"
if ($startupShortcut) {
    Write-Host "Startup shortcut:  $startupShortcut"
}
Write-Host "Web URL:          $desktopWebUrl"
Write-Host ''
Write-Host 'Next (one-time):' -ForegroundColor Yellow
Write-Host '1) Login / payment starts in the browser tab that just opened.'
Write-Host '2) Keep the tray app running; it will keep the bridge alive.'
if ($extensionRequired) {
    Write-Host '3) Verify extension appears as policy-installed.'
} else {
    Write-Host '3) Extension is not required in desktop-full mode.'
}
Write-Host ''
Write-Host "Setup log:       $setupLog"
Stop-Transcript | Out-Null
