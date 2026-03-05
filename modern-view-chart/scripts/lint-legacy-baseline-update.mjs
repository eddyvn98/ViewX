import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildLegacyMetrics } from "./lint-legacy-metrics.mjs";

const CURRENT_REPORT_PATH = path.join(process.cwd(), ".tmp", "eslint-legacy-report.json");
const CURRENT_METRICS_PATH = path.join(process.cwd(), ".tmp", "eslint-legacy-metrics.json");
const BASELINE_PATH = path.join(process.cwd(), ".github", "lint-legacy-baseline.json");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function getHeadSha() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.status !== 0) return "unknown";
  return result.stdout.trim();
}

function loadMetrics() {
  if (existsSync(CURRENT_METRICS_PATH)) {
    return readJson(CURRENT_METRICS_PATH);
  }
  if (existsSync(CURRENT_REPORT_PATH)) {
    return buildLegacyMetrics(readJson(CURRENT_REPORT_PATH));
  }
  throw new Error(
    `Missing lint legacy artifacts. Run "npm run lint:legacy" first to generate ${CURRENT_REPORT_PATH}`,
  );
}

function main() {
  const metrics = loadMetrics();
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    gitSha: getHeadSha(),
    metrics,
  };

  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[lint:legacy:baseline:update] Baseline updated at ${BASELINE_PATH}`);
}

main();
