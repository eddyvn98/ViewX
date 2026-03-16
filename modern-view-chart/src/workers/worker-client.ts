import { Strategy } from '@/features/strategy/types';
import { Candle } from '@/lib/store/types';

export type WorkerJob =
    | { type: 'RUN_BACKTEST'; payload: { strategy: Strategy; candles: Candle[]; initialBalance: number; overrideSymbol?: string; overrideTimeframe?: string; source?: 'MT5' | 'BINANCE'; matrixScopeKey?: string } }
    | { type: 'CALCULATE_INDICATORS'; payload: { indicator: any; candles: Candle[] } }
    | { type: 'CALCULATE_BATCH'; payload: { indicators: any[]; candles: Candle[] } };

export type WorkerResponse = {
    id: string;
    success: boolean;
    data?: any;
    error?: string;
};

// Simple ID counter for mapping requests to responses
let jobId = 0;

class ChartWorkerClient {
    private worker: Worker | null = null;
    private resolvers = new Map<string, (value: any) => void>();
    private rejecters = new Map<string, (reason: any) => void>();

    constructor() {
        if (typeof window !== 'undefined') {
            this.init();
        }
    }

    private init() {
        try {
            // Using Next.js worker pattern
            this.worker = new Worker(new URL('./chart-worker.ts', import.meta.url));

            this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                const { id, success, data, error } = event.data;

                if (success) {
                    const resolve = this.resolvers.get(id);
                    if (resolve) {
                        resolve(data);
                        this.cleanup(id);
                    }
                } else {
                    const reject = this.rejecters.get(id);
                    if (reject) {
                        reject(new Error(error));
                        this.cleanup(id);
                    }
                }
            };

            this.worker.onerror = (error) => {
                console.error('[WorkerClient] Global Worker Error:', error);
            };
        } catch (err) {
            console.error('[WorkerClient] Failed to initialize worker:', err);
        }
    }

    private cleanup(id: string) {
        this.resolvers.delete(id);
        this.rejecters.delete(id);
    }

    private sendJob(type: string, payload: any): Promise<any> {
        if (!this.worker) return Promise.reject(new Error('Worker not initialized'));

        const id = `${Date.now()}-${++jobId}`;
        return new Promise((resolve, reject) => {
            this.resolvers.set(id, resolve);
            this.rejecters.set(id, reject);
            this.worker!.postMessage({ id, type, payload });
        });
    }

    async runBacktest(
        strategy: Strategy,
        candles: Candle[],
        initialBalance: number,
        overrideSymbol?: string,
        overrideTimeframe?: string,
        source?: 'MT5' | 'BINANCE',
        matrixScopeKey?: string
    ) {
        return this.sendJob('RUN_BACKTEST', { strategy, candles, initialBalance, overrideSymbol, overrideTimeframe, source, matrixScopeKey });
    }

    async calculateIndicators(indicator: any, candles: Candle[]) {
        return this.sendJob('CALCULATE_INDICATORS', { indicator, candles });
    }

    async calculateBatch(indicators: any[], candles: Candle[]) {
        return this.sendJob('CALCULATE_BATCH', { indicators, candles });
    }
}

// Export a singleton instance
export const chartWorkerClient = new ChartWorkerClient();
