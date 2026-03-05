import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildLegacyMetrics } from "./lint-legacy-metrics.mjs";

const REPORT_DIR = path.join(process.cwd(), ".tmp");
const CURRENT_REPORT_PATH = path.join(REPORT_DIR, "eslint-legacy-report.json");
const CURRENT_METRICS_PATH = path.join(REPORT_DIR, "eslint-legacy-metrics.json");
const DELTA_JSON_PATH = path.join(REPORT_DIR, "eslint-legacy-delta.json");
const DELTA_SUMMARY_PATH = path.join(REPORT_DIR, "eslint-legacy-delta-summary.txt");
const DEFAULT_BASELINE_PATH = path.join(process.cwd(), ".github", "lint-legacy-baseline.json");
const BASELINE_PATH = process.env.LINT_LEGACY_BASELINE_PATH || DEFAULT_BASELINE_PATH;

function readJson(filePath) {
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function loadCurrentMetrics() {
  if (existsSync(CURRENT_METRICS_PATH)) {
    return readJson(CURRENT_METRICS_PATH);
  }
  if (!existsSync(CURRENT_REPORT_PATH)) {
    throw new Error(
      `Current lint report not found. Run lint:legacy first. Missing: ${CURRENT_REPORT_PATH}`,
    );
  }
  return buildLegacyMetrics(readJson(CURRENT_REPORT_PATH));
}

function buildRuleDelta(currentRuleCounts, baselineRuleCounts) {
  const keys = new Set([
    ...Object.keys(currentRuleCounts || {}),
    ...Object.keys(baselineRuleCounts || {}),
  ]);

  const rows = [];
  for (const key of keys) {
    const current = currentRuleCounts?.[key] || 0;
    const baseline = baselineRuleCounts?.[key] || 0;
    const delta = current - baseline;
    if (delta !== 0) {
      rows.push({ ruleId: key, baseline, current, delta });
    }
  }

  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 10);
}

function formatDelta(currentMetrics, baselineMetrics, baselineMeta) {
  const errorDelta = currentMetrics.totals.errors - baselineMetrics.totals.errors;
  const warningDelta = currentMetrics.totals.warnings - baselineMetrics.totals.warnings;
  const messageDelta = currentMetrics.totals.messages - baselineMetrics.totals.messages;

  const ruleDelta = buildRuleDelta(currentMetrics.ruleCounts, baselineMetrics.ruleCounts);
  const hasRegression = errorDelta > 0 || warningDelta > 0;

  const lines = [];
  lines.push("lint_legacy_delta");
  lines.push(`baseline_path=${BASELINE_PATH}`);
  lines.push(`baseline_generated_at=${baselineMeta.generatedAt || "unknown"}`);
  lines.push(`baseline_git_sha=${baselineMeta.gitSha || "unknown"}`);
  lines.push("");
  lines.push(
    `errors: baseline=${baselineMetrics.totals.errors} current=${currentMetrics.totals.errors} delta=${errorDelta >= 0 ? "+" : ""}${errorDelta}`,
  );
  lines.push(
    `warnings: baseline=${baselineMetrics.totals.warnings} current=${currentMetrics.totals.warnings} delta=${warningDelta >= 0 ? "+" : ""}${warningDelta}`,
  );
  lines.push(
    `messages: baseline=${baselineMetrics.totals.messages} current=${currentMetrics.totals.messages} delta=${messageDelta >= 0 ? "+" : ""}${messageDelta}`,
  );
  lines.push(`regression=${hasRegression ? "yes" : "no"}`);
  lines.push("");
  lines.push("top_rule_deltas:");
  if (ruleDelta.length === 0) {
    lines.push("- none");
  } else {
    for (const row of ruleDelta) {
      lines.push(
        `- ${row.ruleId}\tbaseline=${row.baseline}\tcurrent=${row.current}\tdelta=${row.delta >= 0 ? "+" : ""}${row.delta}`,
      );
    }
  }

  return {
    hasRegression,
    errorDelta,
    warningDelta,
    messageDelta,
    ruleDelta,
    summaryText: lines.join("\n"),
  };
}

function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  if (!existsSync(BASELINE_PATH)) {
    console.error(`[lint:legacy:delta] Baseline file not found: ${BASELINE_PATH}`);
    process.exit(1);
  }

  const baselineRaw = readJson(BASELINE_PATH);
  const baselineMetrics = baselineRaw.metrics || baselineRaw;
  const baselineMeta = {
    generatedAt: baselineRaw.generatedAt,
    gitSha: baselineRaw.gitSha,
  };
  const currentMetrics = loadCurrentMetrics();

  const delta = formatDelta(currentMetrics, baselineMetrics, baselineMeta);
  const deltaJson = {
    generatedAt: new Date().toISOString(),
    baselinePath: BASELINE_PATH,
    baselineMeta,
    current: currentMetrics.totals,
    baseline: baselineMetrics.totals,
    delta: {
      errors: delta.errorDelta,
      warnings: delta.warningDelta,
      messages: delta.messageDelta,
      hasRegression: delta.hasRegression,
    },
    topRuleDeltas: delta.ruleDelta,
  };

  writeFileSync(DELTA_JSON_PATH, JSON.stringify(deltaJson, null, 2), "utf8");
  writeFileSync(DELTA_SUMMARY_PATH, delta.summaryText, "utf8");

  console.log("[lint:legacy:delta] Legacy baseline comparison");
  console.log(delta.summaryText);
  console.log("");
  console.log(`[lint:legacy:delta] JSON report: ${DELTA_JSON_PATH}`);
  console.log(`[lint:legacy:delta] Summary file: ${DELTA_SUMMARY_PATH}`);

  if (process.env.LINT_LEGACY_FAIL_ON_INCREASE === "1" && delta.hasRegression) {
    process.exit(1);
  }
}

main();
