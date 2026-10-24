import { executeWorkerJob, type WorkerJob, type WorkerResponse } from './worker-jobs';

type WorkerRequest = {
    id: string;
} & WorkerJob;

type WorkerError = Error & { message: string };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const { id, type, payload } = event.data;

    try {
        const result = executeWorkerJob({ type, payload } as WorkerJob);
        const response: WorkerResponse = { id, success: true, data: result };
        self.postMessage(response);
    } catch (error) {
        const err = error as WorkerError;
        console.error(`[Worker] Error in job ${type}:`, err);
        const response: WorkerResponse = { id, success: false, error: err.message };
        self.postMessage(response);
    }
};
