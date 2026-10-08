import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveDefaultSocketUrl, deriveWebClientMode, parseIntervalSeconds } from './socket-config';
import { wsRuntime } from './runtime';

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
        const browserGlobal = globalThis as typeof globalThis & {
            window?: Window;
            localStorage?: Storage;
        };
        const originalWindow = browserGlobal.window;
        const originalLocalStorage = browserGlobal.localStorage;
        const values = new Map<string, string>();
        const fakeStorage = {
            get length() {
                return values.size;
            },
            clear: () => values.clear(),
            getItem: (key: string) => values.get(key) || null,
            key: (index: number) => Array.from(values.keys())[index] || null,
            removeItem: (key: string) => {
                values.delete(key);
            },
            setItem: (key: string, value: string) => {
                values.set(key, value);
            },
        } satisfies Storage;

        Object.defineProperty(browserGlobal, 'window', {
            configurable: true,
            writable: true,
            value: {} as Window,
        });
        Object.defineProperty(browserGlobal, 'localStorage', {
            configurable: true,
            writable: true,
            value: fakeStorage,
        });

        try {
            values.set('auth_user', JSON.stringify({ account_tier: 'pro' }));
            assert.equal(deriveWebClientMode(), 'web_pro');

            values.set('auth_user', JSON.stringify({ plan: 'free' }));
            assert.equal(deriveWebClientMode(), 'web_free');
        } finally {
            if (originalWindow === undefined) Reflect.deleteProperty(browserGlobal, 'window');
            else Object.defineProperty(browserGlobal, 'window', {
                configurable: true,
                writable: true,
                value: originalWindow,
            });
            if (originalLocalStorage === undefined) Reflect.deleteProperty(browserGlobal, 'localStorage');
            else Object.defineProperty(browserGlobal, 'localStorage', {
                configurable: true,
                writable: true,
                value: originalLocalStorage,
            });
        }
    });
});


describe('websocket endpoint routing', () => {
    it('uses the same public hostname with /ws instead of a separate api DNS dependency', () => {
        const browserGlobal = globalThis as typeof globalThis & { window?: Window };
        const originalWindow = browserGlobal.window;
        const originalSocketUrl = wsRuntime.socketUrl;

        Object.defineProperty(browserGlobal, 'window', {
            configurable: true,
            writable: true,
            value: {
                location: {
                    protocol: 'https:',
                    hostname: 'vivutrade.io.vn',
                    host: 'vivutrade.io.vn',
                    port: '',
                },
            } as Window,
        });
        wsRuntime.socketUrl = '';

        try {
            assert.equal(deriveDefaultSocketUrl(), 'wss://vivutrade.io.vn/ws');
        } finally {
            wsRuntime.socketUrl = originalSocketUrl;
            if (originalWindow === undefined) Reflect.deleteProperty(browserGlobal, 'window');
            else Object.defineProperty(browserGlobal, 'window', {
                configurable: true,
                writable: true,
                value: originalWindow,
            });
        }
    });
});
