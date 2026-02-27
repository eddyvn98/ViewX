/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveTagAnchorTime, resolveTagXCoordinate, updatePnlVisuals, TagElements } from './tag-renderer';
import { TagData } from './order-tag-utils';

describe('resolveTagAnchorTime', () => {
    it('uses live anchor for live entry tags', () => {
        const tag = {
            id: '1-entry',
            type: 'entry',
            ticket: 1,
            price: 1.2,
            label: 'BUY',
            color: '#fff',
            pOriginal: { status: 'open', timestamp: 1700000000 }
        } as TagData;

        assert.equal(resolveTagAnchorTime(tag, 1700001000), 1700001000);
    });

    it('uses original timestamp for pending/history', () => {
        const pendingTag = {
            id: '2-entry',
            type: 'entry',
            ticket: 2,
            price: 1.2,
            label: 'BUY',
            color: '#fff',
            pOriginal: { status: 'pending', timestamp: 1700000000 }
        } as TagData;

        const historyTag = {
            id: '3-entry',
            type: 'entry',
            ticket: 3,
            price: 1.2,
            label: 'BUY',
            color: '#fff',
            pOriginal: { status: 'closed', timestamp: 1700002000 }
        } as TagData;

        assert.equal(resolveTagAnchorTime(pendingTag, 1700001000), 1700000000);
        assert.equal(resolveTagAnchorTime(historyTag, 1700001000), 1700002000);
    });
});

describe('resolveTagXCoordinate', () => {
    it('returns direct hit coordinate', () => {
        const timeScale = {
            timeToCoordinate: (time: number) => (time === 100 ? 50 : null)
        } as any;

        assert.equal(resolveTagXCoordinate(timeScale, 100), 50);
    });

    it('falls back to bucket/tolerance coordinate', () => {
        const timeScale = {
            timeToCoordinate: (time: number) => (time === 120 ? 60 : null)
        } as any;

        assert.equal(resolveTagXCoordinate(timeScale, 123), 60);
    });

    it('returns null when out of range', () => {
        const timeScale = {
            timeToCoordinate: (time: number) => {
                void time;
                return null;
            }
        } as any;

        assert.equal(resolveTagXCoordinate(timeScale, 123), null);
    });
});

describe('updatePnlVisuals', () => {
    function makeElements(): TagElements {
        return {
            el: { style: {} } as any,
            label: null,
            price: null,
            priceBox: null,
            pnl: { className: '', textContent: '' } as any
        };
    }

    it('renders positive pnl style for buy entry', () => {
        const elements = makeElements();
        const tag = {
            id: '1-entry',
            type: 'entry',
            ticket: 1,
            price: 100,
            label: 'BUY POS',
            color: '#fff',
            pOriginal: { type: 'buy', open_price: 100, volume: 1 }
        } as TagData;

        updatePnlVisuals(elements, tag, {
            currentPrice: 110,
            draftOrder: null,
            symbolInfo: { symbol: 'EURUSD', digits: 5, trade_contract_size: 1 },
            symbol: 'EURUSD'
        });

        assert.ok(elements.pnl?.className.includes('text-emerald-600'));
        assert.ok((elements.pnl?.textContent || '').length > 0);
    });

    it('renders negative pnl style for sell entry when price rises', () => {
        const elements = makeElements();
        const tag = {
            id: '2-entry',
            type: 'entry',
            ticket: 2,
            price: 100,
            label: 'SELL POS',
            color: '#fff',
            pOriginal: { type: 'sell', open_price: 100, volume: 1 }
        } as TagData;

        updatePnlVisuals(elements, tag, {
            currentPrice: 110,
            draftOrder: null,
            symbolInfo: { symbol: 'EURUSD', digits: 5, trade_contract_size: 1 },
            symbol: 'EURUSD'
        });

        assert.ok(elements.pnl?.className.includes('text-rose-600'));
    });
});
