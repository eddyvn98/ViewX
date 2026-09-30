import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildUserSetupOutboxScopeKey,
    shouldPreferDurableOutbox,
} from './durable-outbox';

describe('durable user setup outbox', () => {
    it('scopes guest state to the device client id', () => {
        assert.equal(
            buildUserSetupOutboxScopeKey('client-123', false, '', ''),
            'guest:client-123',
        );
    });

    it('scopes authenticated state to the user identity instead of the device', () => {
        assert.equal(
            buildUserSetupOutboxScopeKey(
                'client-123',
                true,
                JSON.stringify({ _id: 'user-42', username: 'alice' }),
                '',
            ),
            'user:user-42',
        );
    });

    it('falls back to the client id when authenticated user identity is unavailable', () => {
        assert.equal(
            buildUserSetupOutboxScopeKey('client-123', true, '{}', ''),
            'user-client:client-123',
        );
    });

    it('prefers a durable pending snapshot only when it is newer than the server copy', () => {
        assert.equal(
            shouldPreferDurableOutbox({ clientUpdatedAt: 200 }, 100),
            true,
        );
        assert.equal(
            shouldPreferDurableOutbox({ clientUpdatedAt: 100 }, 200),
            false,
        );
        assert.equal(
            shouldPreferDurableOutbox({ clientUpdatedAt: 100 }, Number.NaN),
            true,
        );
        assert.equal(
            shouldPreferDurableOutbox(null, 100),
            false,
        );
    });
});
