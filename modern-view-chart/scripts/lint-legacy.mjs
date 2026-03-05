import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runEslint } from "./lint-common.mjs";
import { buildLegacyMetrics, toLegacySummaryText } from "./lint-legacy-metrics.mjs";

const REPORT_DIR = path.join(process.cwd(), ".tmp");
const REPORT_PATH = path.join(REPORT_DIR, "eslint-legacy-report.json");
const SUMMARY_PATH = path.join(REPORT_DIR, "eslint-legacy-summary.txt");
const METRICS_PATH = path.join(REPORT_DIR, "eslint-legacy-metrics.json");

function main() {
  mkdirSync(REPORT_DIR, { recursive: true });

  const eslintResult = runEslint([".", "-f", "json", "-o", REPORT_PATH]);

  let reportData = [];
  try {
    const raw = readFileSync(REPORT_PATH, "utf8");
    reportData = JSON.parse(raw);
  } catch (error) {
    console.error("[lint:legacy] Failed to read ESLint JSON report.", error);
    process.exit(eslintResult.status ?? 1);
  }

  const metrics = buildLegacyMetrics(reportData);
  const summaryText = toLegacySummaryText(metrics);

  writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2), "utf8");
  writeFileSync(SUMMARY_PATH, summaryText, "utf8");

  console.log("[lint:legacy] ESLint summary");
  console.log(summaryText);
  console.log("");
  console.log(`[lint:legacy] JSON report: ${REPORT_PATH}`);
  console.log(`[lint:legacy] Metrics file: ${METRICS_PATH}`);
  console.log(`[lint:legacy] Summary file: ${SUMMARY_PATH}`);

  process.exit(eslintResult.status ?? 1);
}

main();
