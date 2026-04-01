import { Candle } from '@/lib/store/types';

const DB_NAME = 'vivutrade_chart_cache';
const DB_VERSION = 1;
const STORE_NAME = 'candles';
const MAX_CANDLES_PER_KEY = 3000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PERSIST_DEBOUNCE_MS = 1200;

type CachedCandlesRecord = {
    key: string;
    updatedAt: number;
    candles: Candle[];
};

type PendingWrite = {
    key: string;
    candles: Candle[];
};

let dbPromise: Promise<IDBDatabase | null> | null = null;
const pendingWrites = new Map<string, PendingWrite>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const isBrowser = () => typeof window !== 'undefined';

const openDb = (): Promise<IDBDatabase | null> => {
    if (!isBrowser() || !('indexedDB' in window)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
        try {
            const req = window.indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };

            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });

    return dbPromise;
};

const withStore = async <T>(
    mode: IDBTransactionMode,
    runner: (store: IDBObjectStore) => Promise<T>,
): Promise<T | null> => {
    const db = await openDb();
    if (!db) return null;
    try {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        return await runner(store);
    } catch {
        return null;
    }
};

const readRecord = async (key: string): Promise<CachedCandlesRecord | null> => {
    const result = await withStore('readonly', async (store) => {
        return await new Promise<CachedCandlesRecord | null>((resolve) => {
            const req = store.get(key);
            req.onsuccess = () => resolve((req.result as CachedCandlesRecord) || null);
            req.onerror = () => resolve(null);
        });
    });
    return result || null;
};

const writeRecord = async (key: string, candles: Candle[]): Promise<void> => {
    const next = candles.length > MAX_CANDLES_PER_KEY
        ? candles.slice(candles.length - MAX_CANDLES_PER_KEY)
        : candles;

    await withStore('readwrite', async (store) => {
        await new Promise<void>((resolve) => {
            const req = store.put({
                key,
                updatedAt: Date.now(),
                candles: next,
            } as CachedCandlesRecord);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        });
        return null;
    });
};

const flushPendingWrites = async () => {
    flushTimer = null;
    if (pendingWrites.size === 0) return;

    const entries = Array.from(pendingWrites.values());
    pendingWrites.clear();

    for (const entry of entries) {
        await writeRecord(entry.key, entry.candles);
    }
};

export const queuePersistCandlesSnapshot = (key: string, candles: Candle[]) => {
    if (!isBrowser() || !key || !Array.isArray(candles) || candles.length === 0) return;
    pendingWrites.set(key, { key, candles });
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        void flushPendingWrites();
    }, PERSIST_DEBOUNCE_MS);
};

export const loadCachedCandlesByKey = async (key: string): Promise<Candle[] | null> => {
    if (!key) return null;
    const record = await readRecord(key);
    if (!record || !Array.isArray(record.candles) || record.candles.length === 0) return null;
    if (Date.now() - Number(record.updatedAt || 0) > CACHE_TTL_MS) return null;
    return record.candles;
};

export const loadBestCachedCandles = async (keys: string[]): Promise<{ key: string; candles: Candle[] } | null> => {
    if (!Array.isArray(keys) || keys.length === 0) return null;

    let best: { key: string; candles: Candle[] } | null = null;
    for (const key of keys) {
        const candles = await loadCachedCandlesByKey(key);
        if (!candles || candles.length === 0) continue;
        if (!best || candles.length > best.candles.length) {
            best = { key, candles };
        }
    }
    return best;
};
