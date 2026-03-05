import { existsSync } from "node:fs";
import { isLintableCodePath, resolveBaseRef, runEslint, runGit } from "./lint-common.mjs";

function getChangedFiles(baseSha) {
  const diff = runGit(["diff", "--name-only", "--diff-filter=ACMR", `${baseSha}...HEAD`], {
    allowFailure: true,
  });
  const headFiles =
    diff.status === 0
      ? diff.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

  const staged = runGit(["diff", "--name-only", "--diff-filter=ACMR", "--cached"], {
    allowFailure: true,
  });
  const stagedFiles =
    staged.status === 0
      ? staged.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

  const unstaged = runGit(["diff", "--name-only", "--diff-filter=ACMR"], {
    allowFailure: true,
  });
  const unstagedFiles =
    unstaged.status === 0
      ? unstaged.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

  const untracked = runGit(["ls-files", "--others", "--exclude-standard"], {
    allowFailure: true,
  });
  const untrackedFiles =
    untracked.status === 0
      ? untracked.stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

  return [...new Set([...headFiles, ...stagedFiles, ...unstagedFiles, ...untrackedFiles])];
}

function resolvePathForCwd(filePath) {
  if (existsSync(filePath)) return filePath;
  const normalized = filePath.replace(/\\/g, "/");
  const slashIndex = normalized.indexOf("/");
  if (slashIndex === -1) return filePath;
  const trimmed = normalized.slice(slashIndex + 1);
  if (existsSync(trimmed)) return trimmed;
  return filePath;
}

function main() {
  const base = resolveBaseRef();
  if (!base) {
    console.log("[lint:changed] Could not resolve base ref. Skipping.");
    process.exit(0);
  }

  console.log(`[lint:changed] Base ref: ${base.baseRef} (${base.baseSha})`);

  const changed = getChangedFiles(base.baseSha).map(resolvePathForCwd);
  const lintTargets = changed.filter(isLintableCodePath);

  if (lintTargets.length === 0) {
    console.log("[lint:changed] No changed lintable files.");
    process.exit(0);
  }

  console.log(`[lint:changed] Linting ${lintTargets.length} file(s).`);
  console.log(`[lint:changed] Targets: ${lintTargets.join(", ")}`);
  const result = runEslint(["--max-warnings=0", ...lintTargets]);
  process.exit(result.status ?? 1);
}

main();
