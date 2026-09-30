import { readStoredAccessToken, readStoredAuthUser } from '@/lib/auth/session';
import { USER_STATE_SCHEMA_VERSION } from './constants';
import type { PersistedSetupState } from './types';

const DB_NAME = 'vivutrade-user-state';
const DB_VERSION = 1;
const STORE_NAME = 'pending-setup-state';

export type DurableUserSetupOutboxRecord = {
    scopeKey: string;
    clientUpdatedAt: number;
    schemaVersion: number;
    snapshot: PersistedSetupState;
};

function readJsonIdentity(raw: string): string {
    if (!raw) return '';
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return String(
            parsed._id ||
            parsed.id ||
            parsed.userId ||
            parsed.sub ||
            parsed.username ||
            parsed.email ||
            ''
        ).trim();
    } catch {
        return '';
    }
}

function readJwtIdentity(token: string): string {
    if (!token || typeof atob !== 'function') return '';
    try {
        const payload = token.split('.')[1] || '';
        if (!payload) return '';
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const parsed = JSON.parse(atob(padded)) as Record<string, unknown>;
        return String(parsed.userId || parsed.sub || parsed.id || '').trim();
    } catch {
        return '';
    }
}

export function buildUserSetupOutboxScopeKey(
    clientId: string,
    isAuthenticated: boolean,
    authUserRaw = typeof window === 'undefined' ? '' : readStoredAuthUser(),
    accessToken = typeof window === 'undefined' ? '' : readStoredAccessToken(),
): string {
    const safeClientId = String(clientId || 'public').trim() || 'public';
    if (!isAuthenticated) return `guest:${safeClientId}`;

    const userIdentity = readJsonIdentity(authUserRaw) || readJwtIdentity(accessToken);
    return userIdentity ? `user:${userIdentity}` : `user-client:${safeClientId}`;
}

function openDatabase(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);

    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'scopeKey' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });
}

export async function readDurableUserSetupOutbox(
    scopeKey: string,
): Promise<DurableUserSetupOutboxRecord | null> {
    const db = await openDatabase();
    if (!db) return null;

    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(scopeKey);
        request.onsuccess = () => {
            const value = request.result as DurableUserSetupOutboxRecord | undefined;
            resolve(value && value.scopeKey === scopeKey ? value : null);
        };
        request.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
        tx.onabort = () => db.close();
    });
}

export async function writeDurableUserSetupOutbox(
    scopeKey: string,
    snapshot: PersistedSetupState,
    clientUpdatedAt: number,
): Promise<boolean> {
    const db = await openDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getRequest = store.get(scopeKey);
        let wrote = false;

        getRequest.onsuccess = () => {
            const current = getRequest.result as DurableUserSetupOutboxRecord | undefined;
            if (current && Number(current.clientUpdatedAt) > clientUpdatedAt) return;
            store.put({
                scopeKey,
                clientUpdatedAt,
                schemaVersion: USER_STATE_SCHEMA_VERSION,
                snapshot,
            } satisfies DurableUserSetupOutboxRecord);
            wrote = true;
        };

        tx.oncomplete = () => {
            db.close();
            resolve(wrote);
        };
        tx.onerror = () => {
            db.close();
            resolve(false);
        };
        tx.onabort = () => {
            db.close();
            resolve(false);
        };
    });
}

export async function deleteDurableUserSetupOutboxIfNotNewer(
    scopeKey: string,
    resolvedClientUpdatedAt: number,
): Promise<boolean> {
    const db = await openDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getRequest = store.get(scopeKey);
        let deleted = false;

        getRequest.onsuccess = () => {
            const current = getRequest.result as DurableUserSetupOutboxRecord | undefined;
            if (!current) return;
            if (Number(current.clientUpdatedAt) <= resolvedClientUpdatedAt) {
                store.delete(scopeKey);
                deleted = true;
            }
        };

        tx.oncomplete = () => {
            db.close();
            resolve(deleted);
        };
        tx.onerror = () => {
            db.close();
            resolve(false);
        };
        tx.onabort = () => {
            db.close();
            resolve(false);
        };
    });
}

export function shouldPreferDurableOutbox(
    record: Pick<DurableUserSetupOutboxRecord, 'clientUpdatedAt'> | null,
    remoteClientUpdatedAt: number,
): boolean {
    if (!record) return false;
    if (!Number.isFinite(record.clientUpdatedAt) || record.clientUpdatedAt <= 0) return false;
    if (!Number.isFinite(remoteClientUpdatedAt) || remoteClientUpdatedAt <= 0) return true;
    return record.clientUpdatedAt > remoteClientUpdatedAt;
}
