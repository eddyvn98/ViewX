/**
 * Calculate the second offset between UTC and a given timezone.
 */
export const getChartTimezoneOffset = (tz: string) => {
    try {
        const now = new Date();
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
        return Math.round((tzDate.getTime() - utcDate.getTime()) / 1000);
    } catch (e) {
        return 0;
    }
};
