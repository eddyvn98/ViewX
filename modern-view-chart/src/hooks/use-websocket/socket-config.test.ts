import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveWebClientMode, parseIntervalSeconds } from './socket-config';

describe('websocket interval duration', () => {
    it('does not request weekly history using a one-minute time span', () => {
        assert.equal(parseIntervalSeconds('D'), 86400);
        assert.equal(parseIntervalSeconds('W'), 604800);
    });

    it('supports canonical minute intervals', () => {
        assert.equal(parseIntervalSeconds('60'), 3600);
        assert.equal(parseIntervalSeconds('10080'), 604800);
    });
});


describe('websocket client mode', () => {
    it('derives web_pro from stored account tier', () => {
        const originalWindow = (globalThis as any).window;
        const originalLocalStorage = (globalThis as any).localStorage;
        const values = new Map<string, string>();
        (globalThis as any).window = {};
        (globalThis as any).localStorage = {
            getItem: (key: string) => values.get(key) || null,
            setItem: (key: string, value: string) => values.set(key, value),
            removeItem: (key: string) => values.delete(key),
        };

        try {
            values.set('auth_user', JSON.stringify({ account_tier: 'pro' }));
            assert.equal(deriveWebClientMode(), 'web_pro');

            values.set('auth_user', JSON.stringify({ plan: 'free' }));
            assert.equal(deriveWebClientMode(), 'web_free');
        } finally {
            if (originalWindow === undefined) delete (globalThis as any).window;
            else (globalThis as any).window = originalWindow;
            if (originalLocalStorage === undefined) delete (globalThis as any).localStorage;
            else (globalThis as any).localStorage = originalLocalStorage;
        }
    });
});
