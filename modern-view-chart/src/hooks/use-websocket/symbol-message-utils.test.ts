import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getAvailableMt5Symbol } from './symbol-message-utils';

describe('getAvailableMt5Symbol', () => {
    it('keeps and trims legacy string payloads', () => {
        assert.equal(getAvailableMt5Symbol(' EURUSDm '), 'EURUSDm');
    });

    it('reads the symbol from the structured MT5 bridge payload', () => {
        assert.equal(
            getAvailableMt5Symbol({ symbol: 'XAUUSDm', path: 'Forex\\Metals\\XAUUSDm' }),
            'XAUUSDm',
        );
    });

    it('rejects malformed payloads instead of adding [object Object] to the market list', () => {
        assert.equal(getAvailableMt5Symbol({ path: 'Forex\\Majors' }), '');
        assert.equal(getAvailableMt5Symbol(null), '');
        assert.equal(getAvailableMt5Symbol(42), '');
    });
});
