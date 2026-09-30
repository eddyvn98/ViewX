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
