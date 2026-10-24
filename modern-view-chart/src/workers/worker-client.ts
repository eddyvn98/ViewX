import type { Strategy } from '@/features/strategy/types';
import type { Candle, IndicatorConfig } from '@/lib/store/types';
import { executeWorkerJob, type WorkerJob, type WorkerResponse } from './worker-jobs';

export type { WorkerJob, WorkerResponse } from './worker-jobs';

let jobId = 0;

class ChartWorkerClient {
    private worker: Worker | null = null;
    private workerFailed = false;
    private resolvers = new Map<string, { resolve: (value: unknown) => void; job: WorkerJob }>();
    private rejecters = new Map<string, (reason: unknown) => void>();

    constructor() {
        if (typeof window !== 'undefined') {
            this.init();
        }
    }

    private fallbackAllPending() {
        const pendingEntries = Array.from(this.resolvers.entries());
        const pendingRejecters = new Map(this.rejecters);
        this.resolvers.clear();
        this.rejecters.clear();

        pendingEntries.forEach(([id, entry]) => {
            try {
                const result = executeWorkerJob(entry.job);
                entry.resolve(result);
            } catch (err) {
                const reject = pendingRejecters.get(id);
                if (reject) {
                    try {
                        reject(err);
                    } catch {
                        // Ignore downstream rejection handler errors.
                    }
                }
            }
        });
    }

    private init() {
        try {
            this.worker = new Worker(new URL('./chart-worker.ts', import.meta.url));
            this.workerFailed = false;

            this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                const { id, success, data, error } = event.data;

                if (success) {
                    const entry = this.resolvers.get(id);
                    if (entry) {
                        entry.resolve(data);
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
                error.preventDefault?.();
                this.workerFailed = true;
                try {
                    this.worker?.terminate();
                } catch {
                    // Ignore worker termination errors.
                }
                this.worker = null;
                this.fallbackAllPending();
            };

            this.worker.onmessageerror = () => {
                this.workerFailed = true;
                try {
                    this.worker?.terminate();
                } catch {
                    // Ignore worker termination errors.
                }
                this.worker = null;
                this.fallbackAllPending();
            };
        } catch {
            this.workerFailed = true;
            this.worker = null;
        }
    }

    private cleanup(id: string) {
        this.resolvers.delete(id);
        this.rejecters.delete(id);
    }

    private sendJob<T = unknown>(job: WorkerJob): Promise<T> {
        if (!this.worker || this.workerFailed) {
            try {
                return Promise.resolve(executeWorkerJob(job) as T);
            } catch (err) {
                return Promise.reject(err instanceof Error ? err : new Error(String(err)));
            }
        }

        const id = `${Date.now()}-${++jobId}`;
        return new Promise<T>((resolve, reject) => {
            this.resolvers.set(id, { resolve: (value) => resolve(value as T), job });
            this.rejecters.set(id, reject);
            try {
                this.worker?.postMessage({ id, type: job.type, payload: job.payload });
            } catch {
                this.cleanup(id);
                try {
                    resolve(executeWorkerJob(job) as T);
                } catch (fallbackErr) {
                    reject(fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr)));
                }
            }
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
