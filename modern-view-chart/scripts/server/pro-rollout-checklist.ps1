param(
    [string]$BaseUrl = $env:PRO_ROLLOUT_BASE_URL,
    [string]$RouteMetricsPath = $env:PRO_ROLLOUT_ROUTE_METRICS_PATH,
    [string]$TimingMetricsPath = $env:PRO_ROLLOUT_TIMING_METRICS_PATH,
    [string]$SecurityMetricsPath = $env:PRO_ROLLOUT_SECURITY_METRICS_PATH,
    [string]$BridgeMetricsPath = $env:PRO_ROLLOUT_BRIDGE_METRICS_PATH,
    [string]$AuditMetricsPath = $env:PRO_ROLLOUT_AUDIT_METRICS_PATH,
    [string]$HealthPath = $env:PRO_ROLLOUT_HEALTH_PATH
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host $Title
    Write-Host ('-' * $Title.Length)
}

function Write-Check([string]$Label, [string]$Endpoint, [string]$Expected) {
    Write-Host ("[ ] " + $Label)
    Write-Host ("    Endpoint: " + $Endpoint)
    Write-Host ("    Expected: " + $Expected)
}

function Normalize-BaseUrl([string]$Url) {
    if ([string]::IsNullOrWhiteSpace($Url)) { return "<BASE_URL>" }
    return $Url.TrimEnd("/")
}

function Normalize-Path([string]$Path, [string]$Fallback) {
    $value = $Path
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = $Fallback
    } else {
        $value = $value.Trim()
    }

    if ($value.StartsWith("/")) { return $value }
    return "/" + $value
}

$resolvedBaseUrl = Normalize-BaseUrl $BaseUrl
$resolvedRouteMetricsPath = Normalize-Path $RouteMetricsPath "<ROUTE_METRICS_ENDPOINT>"
$resolvedTimingMetricsPath = Normalize-Path $TimingMetricsPath "<TIMING_METRICS_ENDPOINT>"
$resolvedSecurityMetricsPath = Normalize-Path $SecurityMetricsPath "<SECURITY_METRICS_ENDPOINT>"
$resolvedBridgeMetricsPath = Normalize-Path $BridgeMetricsPath "<BRIDGE_METRICS_ENDPOINT>"
$resolvedAuditMetricsPath = Normalize-Path $AuditMetricsPath "<AUDIT_METRICS_ENDPOINT>"
$resolvedHealthPath = Normalize-Path $HealthPath "<HEALTH_ENDPOINT>"

Write-Host "Pro Flow Rollout Checklist"
Write-Host "Updated: 2026-03-25"
Write-Host "Source gates: DOCS/PRO_FLOW_ROLLOUT_GATES.md"

Write-Section "1) Gate Metrics To Confirm"
Write-Check "command_route_success" ($resolvedBaseUrl + $resolvedRouteMetricsPath) ">= 99%"
Write-Check "order_ack_p95" ($resolvedBaseUrl + $resolvedTimingMetricsPath) "< 800ms"
Write-Check "cross-user leakage incidents" ($resolvedBaseUrl + $resolvedSecurityMetricsPath) "0"
Write-Check "successful Free-to-Pro bypasses" ($resolvedBaseUrl + $resolvedSecurityMetricsPath) "0"
Write-Check "replay duplicate executions" ($resolvedBaseUrl + $resolvedAuditMetricsPath) "0"
Write-Check "route miss count" ($resolvedBaseUrl + $resolvedBridgeMetricsPath) "No unexplained increase"

Write-Section "2) Evidence Sources"
Write-Host "[ ] Backend route metrics"
Write-Host ("    Placeholder command: Invoke-RestMethod -Method Get -Uri '" + $resolvedBaseUrl + $resolvedRouteMetricsPath + "'")
Write-Host "[ ] WS/backend timing metrics"
Write-Host ("    Placeholder command: Invoke-RestMethod -Method Get -Uri '" + $resolvedBaseUrl + $resolvedTimingMetricsPath + "'")
Write-Host "[ ] Security audit and incident review"
Write-Host ("    Placeholder command: Invoke-RestMethod -Method Get -Uri '" + $resolvedBaseUrl + $resolvedSecurityMetricsPath + "'")
Write-Host "[ ] Bridge registry metrics"
Write-Host ("    Placeholder command: Invoke-RestMethod -Method Get -Uri '" + $resolvedBaseUrl + $resolvedBridgeMetricsPath + "'")
Write-Host "[ ] Audit logs for connect/auth/trade"
Write-Host ("    Placeholder command: Invoke-RestMethod -Method Get -Uri '" + $resolvedBaseUrl + $resolvedAuditMetricsPath + "'")

Write-Section "3) Go / No-Go"
Write-Host "GO only if all gate metrics are within threshold and no no-go trigger is present."
Write-Host "NO-GO if any cross-user leakage, Free-to-Pro bypass, replay duplicate, route failure spike, or sustained latency regression is observed."

Write-Section "4) Stage Reminder"
Write-Host "Current rollout stages:"
Write-Host "  1. Internal alpha"
Write-Host "  2. 5-10 Pro users"
Write-Host "  3. 30-50 Pro users"
Write-Host "  4. Full rollout"

Write-Section "5) Optional Health Probe"
Write-Host ("Health command placeholder: Invoke-RestMethod -Method Get -Uri '" + $resolvedBaseUrl + $resolvedHealthPath + "'")
Write-Host "Keep this endpoint free of credentials; pass auth via the standard environment or session mechanism used by the repo."
