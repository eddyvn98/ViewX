import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const timeframeConfig = read('src/features/chart/components/timeframe-config.ts');
const mobileTimeframes = read('src/components/layout/MobileTimeframeSlide.tsx');
const timeframeToolbar = read('src/features/chart/components/TimeframeToolbar.tsx');
const chartItem = read('src/features/chart/components/ChartItem.tsx');
const chartSlice = read('src/lib/store/slices/chart-slice.ts');
const bridgeMain = read('backend/bridge/main.py');

const expectedTimeframes = [
    { id: '60', label: '1h', mt5: 'TIMEFRAME_H1' },
    { id: '240', label: '4h', mt5: 'TIMEFRAME_H4' },
    { id: '1440', label: '1D', mt5: 'TIMEFRAME_D1' },
    { id: '10080', label: '1W', mt5: 'TIMEFRAME_W1' },
];

for (const { id, label, mt5 } of expectedTimeframes) {
    assert.match(timeframeConfig, new RegExp(`id: '${id}', label: '${label}'`), `missing desktop label ${label}`);
    assert.match(bridgeMain, new RegExp(`"${id}": mt5\\.${mt5}`), `bridge does not map ${id} to ${mt5}`);
}

assert.match(
    mobileTimeframes,
    /\{ id: 'D', label: '1D' \}/,
    'mobile daily timeframe must retain its original label and ID',
);
assert.match(
    mobileTimeframes,
    /\{ id: 'W', label: '1W' \}/,
    'mobile weekly timeframe must retain its original label and ID',
);
assert.match(
    chartSlice,
    /favoriteTimeframes: \['1', '5', '15', '60', '240', 'D'\]/,
    'desktop quick timeframes must return to the original favorites',
);
assert.match(
    chartItem,
    /\{chart\.interval\} • \{chart\.source\}/,
    'chart header must return to the original raw interval display',
);
assert.match(
    timeframeToolbar,
    /const favorites = TIMEFRAME_CONFIG\.filter\(tf => favoriteTimeframes\.includes\(tf\.id\)\);/,
    'desktop toolbar must return to the original favorite-timeframe behavior',
);

console.log('Chart timeframe contract is valid.');
