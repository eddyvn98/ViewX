import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/hooks/use-websocket/message-handler.ts', import.meta.url), 'utf8');

assert.match(
    source,
    /function getAvailableMt5Symbol\(item: unknown\): string[\s\S]*return String\(item\.symbol \|\| ''\)\.trim\(\);/,
    'MT5 symbol messages must extract the symbol field from bridge objects',
);

console.log('MT5 available-symbol message contract is valid.');
