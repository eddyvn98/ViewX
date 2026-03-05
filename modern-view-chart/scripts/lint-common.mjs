import { spawnSync } from "node:child_process";
import path from "node:path";

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

export function isIgnoredPath(filePath) {
  const p = normalizePath(filePath);

  if (
    p.startsWith(".next/") ||
    p.startsWith("out/") ||
    p.startsWith("build/") ||
    p === "next-env.d.ts" ||
    p.startsWith(".playwright-cli/") ||
    p.startsWith("playwright-report/") ||
    p.startsWith("test-results/") ||
    p.startsWith(".tmp/") ||
    p.startsWith("logs/") ||
    p.startsWith("output/") ||
    p.startsWith(".agent/") ||
    p === "build_output.txt"
  ) {
    return true;
  }

  if (p.startsWith(".tmp")) {
    return true;
  }

  if (p.endsWith(".log")) {
    return true;
  }

  if (/^terminal_log.*\.txt$/i.test(path.basename(p))) {
    return true;
  }

  if (/^test_.*\.(js|ts)$/i.test(path.basename(p))) {
    return true;
  }

  return false;
}

export function isLintableCodePath(filePath) {
  const p = normalizePath(filePath);
  return /\.(js|cjs|mjs|ts|tsx)$/i.test(p) && !isIgnoredPath(p);
}

export function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !allowFailure) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(`git ${args.join(" ")} failed: ${err}`);
  }
  return result;
}

export function resolveBaseRef() {
  const baseCandidates = [];
  if (process.env.LINT_BASE_REF) baseCandidates.push(process.env.LINT_BASE_REF);
  if (process.env.GITHUB_BASE_REF) baseCandidates.push(process.env.GITHUB_BASE_REF);
  baseCandidates.push("main", "master");

  const refs = [];
  for (const base of baseCandidates) {
    refs.push(`origin/${base}`);
    refs.push(base);
  }

  for (const base of baseCandidates) {
    runGit(["fetch", "--no-tags", "--depth=50", "origin", base], { allowFailure: true });
  }

  for (const ref of refs) {
    const mb = runGit(["merge-base", "HEAD", ref], { allowFailure: true });
    if (mb.status === 0) {
      return { baseSha: mb.stdout.trim(), baseRef: ref };
    }
  }

  const fallback = runGit(["rev-parse", "HEAD~1"], { allowFailure: true });
  if (fallback.status === 0) {
    return { baseSha: fallback.stdout.trim(), baseRef: "HEAD~1" };
  }

  return null;
}

export function getEslintCommand() {
  return path.join(process.cwd(), "node_modules", ".bin", "eslint");
}

export function runEslint(args) {
  if (process.platform === "win32") {
    const quoteArg = (value) => {
      const escaped = String(value).replace(/"/g, '\\"');
      return /[\s"]/g.test(escaped) ? `"${escaped}"` : escaped;
    };
    const command = ["npx", "eslint", ...args].map(quoteArg).join(" ");
    return spawnSync(command, { stdio: "inherit", encoding: "utf8", shell: true });
  }

  const cmd = getEslintCommand();
  return spawnSync(cmd, args, { stdio: "inherit", encoding: "utf8" });
}
