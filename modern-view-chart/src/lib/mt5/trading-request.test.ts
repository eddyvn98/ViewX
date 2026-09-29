import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMt5WriteFields } from './trading-request';

test('reuses an explicit MT5 request id for a safe retry', () => {
    const fields = buildMt5WriteFields(
        {
            source: 'MT5_PERSONAL',
            accountLogin: '10001',
            terminalId: 'terminal-a',
            broker: 'Broker A',
        },
        'req-retry-1',
    );

    assert.equal(fields.request_id, 'req-retry-1');
    assert.equal(fields.mt5_source, 'MT5_PERSONAL');
    assert.equal(fields.account_login, '10001');
    assert.equal(fields.terminal_id, 'terminal-a');
    assert.equal(fields.broker, 'Broker A');
});
