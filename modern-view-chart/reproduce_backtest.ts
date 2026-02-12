
import { BacktestRunner } from './src/features/strategy/logic/BacktestRunner';
import { Strategy } from './src/features/strategy/types';
import { Candle } from './src/lib/store/types';

// Mock Data
const candles: Candle[] = [];
const now = Date.now();
// Generate 200 candles (1 min interval)
for (let i = 0; i < 200; i++) {
    candles.push({
        time: (now - (200 - i) * 60000) / 1000, // Seconds
        open: 100 + Math.random(),
        high: 105 + Math.random(),
        low: 95 + Math.random(),
        close: 100 + Math.random(),
        volume: 1000
    });
}

// Mock Strategy
const strategy: Strategy = {
    id: 'test-strat',
    name: 'Test Strategy',
    side: 'BUY',
    active: true,
    symbol: '', // Dynamic
    entry: {
        operator: 'AND',
        conditions: [
            {
                id: 'always-true',
                left: { type: 'RSI', params: [14] }, // Will force calculation
                comparator: '>',
                right: 0
            }
        ]
    },
    risk: {
        sl: 10,
        tp: 20,
        lotSize: 0.1,
        trailing: false
    },
    positionMode: 'single_position',
    executionMode: 'virtual',
    entryType: 'market'
};

try {
    console.log("Running Backtest...");
    const positions = BacktestRunner.run(strategy, candles, 10000, 'BTCUSDM');
    console.log("Positions Generated:", positions.length);
    if (positions.length > 0) {
        console.log("First Position:", positions[0]);
        console.log("Last Position:", positions[positions.length - 1]);
    }
} catch (error) {
    console.error("Backtest Failed:", error);
}
