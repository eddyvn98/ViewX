export const STRATEGY_RUNNER_LOCK_NAME = 'vivutrade-strategy-runner-v1';

export interface RunnerLockManager {
    request<T>(
        name: string,
        options: { mode: 'exclusive'; signal?: AbortSignal },
        callback: () => Promise<T> | T,
    ): Promise<T>;
}

function createAbortError(): Error {
    const error = new Error('Strategy runner leadership request aborted.');
    error.name = 'AbortError';
    return error;
}

export async function holdStrategyRunnerLeadership(
    locks: RunnerLockManager,
    signal: AbortSignal,
    onLeadershipAcquired: () => void,
): Promise<void> {
    await locks.request(
        STRATEGY_RUNNER_LOCK_NAME,
        { mode: 'exclusive', signal },
        async () => {
            if (signal.aborted) throw createAbortError();
            onLeadershipAcquired();
            await new Promise<void>((resolve) => {
                if (signal.aborted) {
                    resolve();
                    return;
                }
                signal.addEventListener('abort', () => resolve(), { once: true });
            });
        },
    );
}
