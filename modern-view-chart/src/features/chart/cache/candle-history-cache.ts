import type { Candle } from '@/lib/store/types';
import { normalizeSymbol } from '@/lib/utils/symbol';

const DB_NAME = 'vivutrade-chart-cache';
const DB_VERSION = 1;
const STORE_NAME = 'candle-history';
const MAX_CACHED_CANDLES = 5000;
const WRITE_DELAY_MS = 1200;

type CandleCacheRecord = {
    key: string;
    source: string;
    symbol: string;
    interval: string;
    candles: Candle[];
    updatedAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();
const pendingSnapshots = new Map<string, CandleCacheRecord>();

export function buildCandleCacheKey(source: string, symbol: string, interval: string): string {
    return [
        String(source || '').trim().toUpperCase(),
        normalizeSymbol(String(symbol || '').trim()),
        String(interval || '').trim(),
    ].join(':');
}

function openDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => resolve(null);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
    });
    return dbPromise;
}

export async function loadCachedCandles(
    source: string,
    symbol: string,
    interval: string,
): Promise<Candle[]> {
    const db = await openDb();
    if (!db) return [];

    const key = buildCandleCacheKey(source, symbol, interval);
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(key);
        request.onerror = () => resolve([]);
        request.onsuccess = () => {
            const record = request.result as CandleCacheRecord | undefined;
            resolve(Array.isArray(record?.candles) ? record.candles : []);
        };
    });
}

async function persistRecord(record: CandleCacheRecord): Promise<void> {
    const db = await openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
        tx.objectStore(STORE_NAME).put(record);
    });
}

export function scheduleCandleCacheWrite(
    source: string,
    symbol: string,
    interval: string,
    candles: Candle[],
): void {
    if (typeof indexedDB === 'undefined') return;

    const key = buildCandleCacheKey(source, symbol, interval);
    const snapshot = candles.length > MAX_CACHED_CANDLES
        ? candles.slice(candles.length - MAX_CACHED_CANDLES)
        : [...candles];

    pendingSnapshots.set(key, {
        key,
        source: String(source || '').toUpperCase(),
        symbol: normalizeSymbol(symbol),
        interval: String(interval || ''),
        candles: snapshot,
        updatedAt: Date.now(),
    });

    const existing = pendingWrites.get(key);
    if (existing) clearTimeout(existing);

    pendingWrites.set(key, setTimeout(() => {
        pendingWrites.delete(key);
        const record = pendingSnapshots.get(key);
        pendingSnapshots.delete(key);
        if (record) void persistRecord(record);
    }, WRITE_DELAY_MS));
}
