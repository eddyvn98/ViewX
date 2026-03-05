import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project artifacts and temporary files:
    ".playwright-cli/**",
    "playwright-report/**",
    "test-results/**",
    ".tmp/**",
    ".tmp*",
    "logs/**",
    "output/**",
    "*.log",
    "build_output.txt",
    "terminal_log*.txt",
    // Local agent/cache folders:
    ".agent/**",
    // Ad-hoc test scripts outside official tests/:
    "test_*.js",
    "test_*.ts",
  ]),
]);

export default eslintConfig;
