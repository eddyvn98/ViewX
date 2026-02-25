param(
    [int]$Clients = 100,
    [int]$DurationSec = 900,
    [int]$RampSec = 60,
    [int]$HealthPollSec = 10,
    [int]$SampleSec = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$LogsDir = Join-Path $RepoRoot "logs"
$NpmCmd = "C:\Program Files\nodejs\npm.cmd"
$NodeHome = "C:\Program Files\nodejs"
$PythonCmd = "C:\Users\eddyvn\AppData\Local\Programs\Python\Python310\python.exe"

if (-not (Test-Path $NpmCmd)) {
    throw "npm not found at '$NpmCmd'."
}
if (-not (Test-Path $PythonCmd)) {
    $pythonLookup = Get-Command "python" -ErrorAction SilentlyContinue
    if ($null -eq $pythonLookup) { throw "python is not available." }
    $PythonCmd = $pythonLookup.Source
}
if (-not ($env:Path -split ";" | Where-Object { $_ -eq $NodeHome })) {
    $env:Path = "$NodeHome;$env:Path"
}

Set-Location $RepoRoot
New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$soakReportPath = Join-Path $LogsDir "ws-soak-chaos-$stamp.json"
$metricsPath = Join-Path $LogsDir "system-metrics-$stamp.json"
$soakStdOut = Join-Path $LogsDir "ws-soak-chaos-$stamp.out.log"
$soakStdErr = Join-Path $LogsDir "ws-soak-chaos-$stamp.err.log"

$script:chaosEvents = @()
$samples = New-Object System.Collections.Generic.List[object]

function Write-ChaosEvent([string]$name, [string]$status, [string]$detail = "") {
    $script:chaosEvents += [pscustomobject]@{
        ts = (Get-Date).ToString("o")
        name = $name
        status = $status
        detail = $detail
    }
    Write-Host "[chaos] $name -> $status $detail"
}

function Stop-ByPattern([string]$pattern) {
    $procs = Get-CimInstance Win32_Process | Where-Object {
        $_.CommandLine -and $_.CommandLine -match $pattern
    }
    $count = 0
    foreach ($p in $procs) {
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
            $count += 1
        }
        catch {
            # Ignore stale PID/process race.
        }
    }
    return $count
}

function Start-Bridge {
    Start-Process -FilePath $PythonCmd `
        -ArgumentList @("-u", "backend/bridge/main.py") `
        -WorkingDirectory $RepoRoot `
        -PassThru | Out-Null
}

function Start-Tunnel {
    Start-Process -FilePath $PythonCmd `
        -ArgumentList @("-u", "start_mobile_access.py") `
        -WorkingDirectory $RepoRoot `
        -PassThru | Out-Null
}

function Sample-System {
    $cpu = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples[0].CookedValue
    $os = Get-CimInstance Win32_OperatingSystem
    $freeGb = [math]::Round(($os.FreePhysicalMemory / 1MB), 3)
    $totalGb = [math]::Round(($os.TotalVisibleMemorySize / 1MB), 3)
    $usedPct = if ($totalGb -gt 0) { [math]::Round(((($totalGb - $freeGb) / $totalGb) * 100), 2) } else { 0 }

    $samples.Add([pscustomobject]@{
        ts = (Get-Date).ToString("o")
        cpu_percent = [math]::Round($cpu, 2)
        mem_free_gb = $freeGb
        mem_total_gb = $totalGb
        mem_used_percent = $usedPct
    })
}

Write-Host "[soak-chaos] Starting soak test process..."
$soakArgs = @(
    "run", "soak:ws", "--",
    "--clients", $Clients,
    "--duration-sec", $DurationSec,
    "--ramp-sec", $RampSec,
    "--health-poll-sec", $HealthPollSec,
    "--output", $soakReportPath
)

$soak = Start-Process -FilePath $NpmCmd `
    -ArgumentList $soakArgs `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $soakStdOut `
    -RedirectStandardError $soakStdErr `
    -PassThru

$startAt = Get-Date
$didBridgeChaos = $false
$didTunnelChaos = $false
$didDbChaos = $false

while (-not $soak.HasExited) {
    $elapsed = [int]((Get-Date) - $startAt).TotalSeconds
    Sample-System

    if (-not $didBridgeChaos -and $elapsed -ge 120) {
        try {
            $stopped = Stop-ByPattern "backend/bridge/main.py"
            Start-Bridge
            $didBridgeChaos = $true
            Write-ChaosEvent "bridge_restart" "ok" "stopped=$stopped"
        }
        catch {
            $didBridgeChaos = $true
            Write-ChaosEvent "bridge_restart" "error" $_.Exception.Message
        }
    }

    if (-not $didTunnelChaos -and $elapsed -ge 240) {
        try {
            $stoppedPy = Stop-ByPattern "start_mobile_access.py"
            $stoppedCf = Stop-ByPattern "cloudflared.exe tunnel --protocol http2 --url http://localhost:(3000|8091)"
            Start-Tunnel
            $didTunnelChaos = $true
            Write-ChaosEvent "tunnel_restart" "ok" "stopped_py=$stoppedPy stopped_cf=$stoppedCf"
        }
        catch {
            $didTunnelChaos = $true
            Write-ChaosEvent "tunnel_restart" "error" $_.Exception.Message
        }
    }

    if (-not $didDbChaos -and $elapsed -ge 360) {
        try {
            $dbUpScript = Join-Path $PSScriptRoot "db-up.ps1"
            & $dbUpScript
            $didDbChaos = $true
            Write-ChaosEvent "db_reconnect_attempt" "ok" "db-up executed"
        }
        catch {
            $didDbChaos = $true
            Write-ChaosEvent "db_reconnect_attempt" "error" $_.Exception.Message
        }
    }

    Start-Sleep -Seconds ([math]::Max(1, $SampleSec))
    try { $soak.Refresh() } catch {}
}

Wait-Process -Id $soak.Id
try { $soak.Refresh() } catch {}

Sample-System

$cpuAvg = ($samples | Measure-Object -Property cpu_percent -Average).Average
$cpuMax = ($samples | Measure-Object -Property cpu_percent -Maximum).Maximum
$memFreeMin = ($samples | Measure-Object -Property mem_free_gb -Minimum).Minimum
$memFreeMax = ($samples | Measure-Object -Property mem_free_gb -Maximum).Maximum
$memFreeDrop = if (($null -ne $memFreeMin) -and ($null -ne $memFreeMax)) { [math]::Round(($memFreeMax - $memFreeMin), 3) } else { 0 }

$summary = [pscustomobject]@{
    generated_at = (Get-Date).ToString("o")
    config = [pscustomobject]@{
        clients = $Clients
        duration_sec = $DurationSec
        ramp_sec = $RampSec
        health_poll_sec = $HealthPollSec
        sample_sec = $SampleSec
    }
    process = [pscustomobject]@{
        soak_exit_code = $soak.ExitCode
        soak_report_path = $soakReportPath
        soak_stdout_path = $soakStdOut
        soak_stderr_path = $soakStdErr
    }
    resource = [pscustomobject]@{
        cpu_avg_percent = [math]::Round($cpuAvg, 2)
        cpu_max_percent = [math]::Round($cpuMax, 2)
        mem_free_min_gb = [math]::Round($memFreeMin, 3)
        mem_free_max_gb = [math]::Round($memFreeMax, 3)
        mem_free_drop_gb = $memFreeDrop
    }
    chaos_events = $chaosEvents
    samples = $samples
}

$summary | ConvertTo-Json -Depth 6 | Set-Content -Path $metricsPath -Encoding UTF8

Write-Host "[soak-chaos] Done. ExitCode=$($soak.ExitCode)"
Write-Host "[soak-chaos] Soak report: $soakReportPath"
Write-Host "[soak-chaos] Resource report: $metricsPath"

if ($soak.ExitCode -ne 0) {
    exit $soak.ExitCode
}
