
/**
 * BackgroundService - Manages browser persistence to prevent hibernation.
 * Uses Screen Wake Lock API.
 */
class BackgroundService {
    private wakeLock: any = null;

    /**
     * Request a Screen Wake Lock to prevent the display from sleeping
     * and discourage the browser from hibernating the tab.
     */
    async requestWakeLock() {
        if (!('wakeLock' in navigator)) {
            console.warn('[BackgroundService] Screen Wake Lock API not supported');
            return;
        }

        try {
            // @ts-ignore
            this.wakeLock = await navigator.wakeLock.request('screen');
            console.log('🔒 [BackgroundService] Wake Lock Active');

            this.wakeLock.addEventListener('release', () => {
                console.log('🔓 [BackgroundService] Wake Lock Released');
                this.wakeLock = null;
            });
        } catch (err: any) {
            console.error(`[BackgroundService] Failed to acquire Wake Lock: ${err.name}, ${err.message}`);
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
        this.requestWakeLock();
    }
}

export const backgroundService = new BackgroundService();
