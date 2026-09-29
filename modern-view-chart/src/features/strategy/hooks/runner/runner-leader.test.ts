import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { holdStrategyRunnerLeadership, type RunnerLockManager } from './runner-leader';

class FakeLockManager implements RunnerLockManager {
    private tail: Promise<unknown> = Promise.resolve();

    request<T>(
        _name: string,
        options: { mode: 'exclusive'; signal?: AbortSignal },
        callback: () => Promise<T> | T,
    ): Promise<T> {
        const run = this.tail.then(async () => {
            if (options.signal?.aborted) {
                const error = new Error('aborted');
                error.name = 'AbortError';
                throw error;
            }
            return callback();
        });
        this.tail = run.then(() => undefined, () => undefined);
        return run;
    }
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('strategy runner cross-tab leadership', () => {
    it('allows only one tab to own the runner and hands leadership to the next tab', async () => {
        const locks = new FakeLockManager();
        const first = new AbortController();
        const second = new AbortController();
        const events: string[] = [];

        const firstRun = holdStrategyRunnerLeadership(locks, first.signal, () => events.push('first'));
        await tick();

        const secondRun = holdStrategyRunnerLeadership(locks, second.signal, () => events.push('second'));
        await tick();

        assert.deepEqual(events, ['first']);

        first.abort();
        await firstRun;
        await tick();

        assert.deepEqual(events, ['first', 'second']);

        second.abort();
        await secondRun;
    });
});
