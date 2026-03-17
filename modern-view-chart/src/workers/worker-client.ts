import type { Strategy } from '@/features/strategy/types';
import type { Candle, IndicatorConfig } from '@/lib/store/types';

export type WorkerJob =
    | { type: 'RUN_BACKTEST'; payload: { strategy: Strategy; candles: Candle[]; initialBalance: number; overrideSymbol?: string; overrideTimeframe?: string; source?: 'MT5' | 'BINANCE'; matrixScopeKey?: string } }
    | { type: 'CALCULATE_INDICATORS'; payload: { indicator: IndicatorConfig; candles: Candle[] } }
    | { type: 'CALCULATE_BATCH'; payload: { indicators: IndicatorConfig[]; candles: Candle[] } };

export type WorkerResponse<T = unknown> = {
    id: string;
    success: boolean;
    data?: T;
    error?: string;
};

let jobId = 0;

class ChartWorkerClient {
    private worker: Worker | null = null;
    private resolvers = new Map<string, (value: unknown) => void>();
    private rejecters = new Map<string, (reason: unknown) => void>();

    constructor() {
        if (typeof window !== 'undefined') {
            this.init();
        }
    }

    private init() {
        try {
            this.worker = new Worker(new URL('./chart-worker.ts', import.meta.url));

            this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                const { id, success, data, error } = event.data;

                if (success) {
                    const resolve = this.resolvers.get(id);
                    if (resolve) {
                        resolve(data);
                        this.cleanup(id);
                    }
                    return;
                }

                const reject = this.rejecters.get(id);
                if (reject) {
                    reject(new Error(error ?? 'Unknown worker error'));
                    this.cleanup(id);
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

    private sendJob<T = unknown>(job: WorkerJob): Promise<T> {
        if (!this.worker) {
            return Promise.reject(new Error('Worker not initialized'));
        }

        const id = `${Date.now()}-${++jobId}`;
        return new Promise<T>((resolve, reject) => {
            this.resolvers.set(id, (value) => resolve(value as T));
            this.rejecters.set(id, reject);
            this.worker?.postMessage({ id, type: job.type, payload: job.payload });
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
        return this.sendJob({
            type: 'RUN_BACKTEST',
            payload: { strategy, candles, initialBalance, overrideSymbol, overrideTimeframe, source, matrixScopeKey },
        });
    }

    async calculateIndicators(indicator: IndicatorConfig, candles: Candle[]) {
        return this.sendJob({
            type: 'CALCULATE_INDICATORS',
            payload: { indicator, candles },
        });
    }

    async calculateBatch(indicators: IndicatorConfig[], candles: Candle[]) {
        return this.sendJob({
            type: 'CALCULATE_BATCH',
            payload: { indicators, candles },
        });
    }
}

export const chartWorkerClient = new ChartWorkerClient();
