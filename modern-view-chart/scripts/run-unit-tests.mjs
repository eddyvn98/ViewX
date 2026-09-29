import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve('src');
const tests = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.test.ts')) tests.push(full);
  }
}

if (fs.existsSync(root)) walk(root);
tests.sort();

if (tests.length === 0) {
  console.error('[test:unit] No *.test.ts files found under src');
  process.exit(1);
}

console.log(`[test:unit] Running ${tests.length} test file(s)`);
const args = ['--yes', 'tsx', '--import', './tests/unit.setup.ts', '--test', ...tests];

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npxCommand, args, { stdio: 'inherit' });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
