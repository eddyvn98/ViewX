/**
 * BackgroundService - Manages browser persistence to prevent hibernation.
 * Uses Screen Wake Lock API.
 */
type WakeLockSentinelLike = {
    release: () => Promise<void>;
    addEventListener: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
    wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinelLike>;
    };
};

class BackgroundService {
    private wakeLock: WakeLockSentinelLike | null = null;

    /**
     * Request a Screen Wake Lock to prevent the display from sleeping
     * and discourage the browser from hibernating the tab.
     */
    async requestWakeLock() {
        const wakeLockApi = (navigator as NavigatorWithWakeLock).wakeLock;
        if (!wakeLockApi) {
            console.warn('[BackgroundService] Screen Wake Lock API not supported');
            return;
        }

        try {
            this.wakeLock = await wakeLockApi.request('screen');
            console.log('[BackgroundService] Wake Lock Active');

            this.wakeLock.addEventListener('release', () => {
                console.log('[BackgroundService] Wake Lock Released');
                this.wakeLock = null;
            });
        } catch (err: unknown) {
            const error = err as { name?: string; message?: string };
            console.error(
                `[BackgroundService] Failed to acquire Wake Lock: ${error.name ?? 'UnknownError'}, ${error.message ?? 'unknown'}`,
            );
        }
    }

    /**
     * Release the wake lock
     */
    async releaseWakeLock() {
        if (this.wakeLock) {
            await this.wakeLock.release();
            this.wakeLock = null;
        }
    }

    /**
     * Initialize listeners to re-acquire lock after visibility changes
     */
    init() {
        document.addEventListener('visibilitychange', async () => {
            if (this.wakeLock !== null && document.visibilityState === 'visible') {
                await this.requestWakeLock();
            }
        });

        // Initial request
        void this.requestWakeLock();
    }
}

export const backgroundService = new BackgroundService();
