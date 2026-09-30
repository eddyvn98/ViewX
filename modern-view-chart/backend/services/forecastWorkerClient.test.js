import assert from 'node:assert/strict';
import test from 'node:test';

test('worker startup failure falls back instead of hanging forever', async () => {
    const originalPythonBin = process.env.FORECAST_PYTHON_BIN;
    const originalStartupTimeout = process.env.FORECAST_WORKER_STARTUP_TIMEOUT_MS;

    process.env.FORECAST_PYTHON_BIN = process.execPath;
    process.env.FORECAST_WORKER_STARTUP_TIMEOUT_MS = '1500';

    const {
        executeForecastOnWorker,
        stopForecastWorker,
    } = await import(`./forecastWorkerClient.js?startup-failure=${Date.now()}`);

    try {
        const outcome = await Promise.race([
            executeForecastOnWorker({ candles: [] }, 1000),
            new Promise((resolve) => setTimeout(() => resolve('hung'), 2500)),
        ]);

        assert.notEqual(outcome, 'hung', 'worker startup promise must always settle');
        assert.equal(outcome, null);
    } finally {
        stopForecastWorker();
        if (originalPythonBin === undefined) delete process.env.FORECAST_PYTHON_BIN;
        else process.env.FORECAST_PYTHON_BIN = originalPythonBin;
        if (originalStartupTimeout === undefined) delete process.env.FORECAST_WORKER_STARTUP_TIMEOUT_MS;
        else process.env.FORECAST_WORKER_STARTUP_TIMEOUT_MS = originalStartupTimeout;
    }
});

test('auto-restarts worker in background after unexpected exit', async () => {
    const originalPythonBin = process.env.FORECAST_PYTHON_BIN;
    const originalStartupTimeout = process.env.FORECAST_WORKER_STARTUP_TIMEOUT_MS;
    const originalAutoRestart = process.env.FORECAST_WORKER_AUTO_RESTART;

    process.env.FORECAST_PYTHON_BIN = process.execPath;
    process.env.FORECAST_WORKER_STARTUP_TIMEOUT_MS = '1000';
    delete process.env.FORECAST_WORKER_AUTO_RESTART;

    const {
        startForecastWorker,
        stopForecastWorker,
    } = await import(`./forecastWorkerClient.js?auto-restart=${Date.now()}`);

    try {
        const firstReady = await startForecastWorker();
        assert.equal(firstReady, false, 'faulty worker fails startup');

        // Allow backoff timer (INITIAL_RESTART_DELAY_MS = 2000ms) to trigger a restart attempt
        await new Promise((resolve) => setTimeout(resolve, 2500));
    } finally {
        stopForecastWorker();
        if (originalPythonBin === undefined) delete process.env.FORECAST_PYTHON_BIN;
        else process.env.FORECAST_PYTHON_BIN = originalPythonBin;
        if (originalStartupTimeout === undefined) delete process.env.FORECAST_WORKER_STARTUP_TIMEOUT_MS;
        else process.env.FORECAST_WORKER_STARTUP_TIMEOUT_MS = originalStartupTimeout;
        if (originalAutoRestart === undefined) delete process.env.FORECAST_WORKER_AUTO_RESTART;
        else process.env.FORECAST_WORKER_AUTO_RESTART = originalAutoRestart;
    }
});
