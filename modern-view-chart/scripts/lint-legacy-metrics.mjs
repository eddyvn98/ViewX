export function buildLegacyMetrics(reportData, { topRulesLimit = 10, topFilesLimit = 20 } = {}) {
  const ruleCount = new Map();
  const fileStats = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalMessages = 0;
  let filesWithErrors = 0;
  let filesWithWarnings = 0;

  for (const file of reportData) {
    const errors = file.errorCount || 0;
    const warnings = file.warningCount || 0;
    totalErrors += errors;
    totalWarnings += warnings;
    totalMessages += (file.messages || []).length;

    if (errors > 0) filesWithErrors += 1;
    if (warnings > 0) filesWithWarnings += 1;

    if (errors > 0 || warnings > 0) {
      fileStats.push({
        filePath: file.filePath,
        errors,
        warnings,
      });
    }

    for (const message of file.messages || []) {
      const rule = message.ruleId || "(unknown)";
      ruleCount.set(rule, (ruleCount.get(rule) || 0) + 1);
    }
  }

  const topRules = [...ruleCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topRulesLimit)
    .map(([ruleId, count]) => ({ ruleId, count }));

  const topFiles = fileStats
    .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings)
    .slice(0, topFilesLimit);

  return {
    schemaVersion: 1,
    totals: {
      errors: totalErrors,
      warnings: totalWarnings,
      messages: totalMessages,
      filesWithErrors,
      filesWithWarnings,
      totalFiles: reportData.length,
    },
    ruleCounts: Object.fromEntries(ruleCount),
    topRules,
    topFiles,
  };
}

export function toLegacySummaryText(metrics) {
  const lines = [];
  lines.push(`errors=${metrics.totals.errors}`);
  lines.push(`warnings=${metrics.totals.warnings}`);
  lines.push(`messages=${metrics.totals.messages}`);
  lines.push(`files_with_errors=${metrics.totals.filesWithErrors}`);
  lines.push(`files_with_warnings=${metrics.totals.filesWithWarnings}`);
  lines.push(`total_files=${metrics.totals.totalFiles}`);
  lines.push("");
  lines.push("top_rules:");
  for (const rule of metrics.topRules) {
    lines.push(`- ${rule.count}\t${rule.ruleId}`);
  }
  lines.push("");
  lines.push("top_files:");
  for (const file of metrics.topFiles) {
    lines.push(`- ${file.errors}\t${file.warnings}\t${file.filePath}`);
  }
  return lines.join("\n");
}
