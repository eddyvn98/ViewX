import { useEffect, useRef } from 'react';
import { IChartApi } from 'lightweight-charts';

/**
 * useChartSync
 * Synchronizes multiple chart instances so they all share the same visible time range.
 */
export function useChartSync(charts: (IChartApi | null)[]) {
    const isSyncingRef = useRef(false);

    useEffect(() => {
        const validCharts = charts.filter((c): c is IChartApi => c !== null);
        if (validCharts.length < 2) return;

        const syncHandlers = new Map<IChartApi, (timeRange: any) => void>();

        validCharts.forEach((masterChart) => {
            const handler = (timeRange: any) => {
                if (!timeRange || isSyncingRef.current) return;

                isSyncingRef.current = true;
                try {
                    const masterTimeScale = masterChart.timeScale();
                    const rightOffset = masterTimeScale.options().rightOffset;

                    validCharts.forEach((slaveChart) => {
                        if (slaveChart !== masterChart) {
                            try {
                                const slaveTimeScale = slaveChart.timeScale();
                                if (!slaveTimeScale) return;

                                slaveTimeScale.applyOptions({ rightOffset });
                                slaveTimeScale.setVisibleRange(timeRange);
                            } catch (e) {
                                // Ignore issues with specific slave charts (e.g. if being destroyed)
                            }
                        }
                    });
                } finally {
                    // Use a tiny timeout to let the events settle
                    setTimeout(() => {
                        isSyncingRef.current = false;
                    }, 0);
                }
            };

            masterChart.timeScale().subscribeVisibleTimeRangeChange(handler);
            syncHandlers.set(masterChart, handler);
        });

        // FORCE INITIAL SYNC: Apply the first chart's range to all others
        if (validCharts.length > 0) {
            try {
                const mainChart = validCharts[0];
                const range = mainChart.timeScale().getVisibleRange();
                if (range) {
                    validCharts.forEach(slave => {
                        if (slave !== mainChart) {
                            try {
                                slave.timeScale().setVisibleRange(range);
                            } catch (e) {
                                // Ignore initial sync error
                            }
                        }
                    });
                }
            } catch (err) {
                // Ignore main chart range error
            }
        }

        return () => {
            syncHandlers.forEach((handler, chart) => {
                try {
                    chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
                } catch (e) {
                    // Ignore cleanup errors
                }
            });
        };
    }, [charts]);
}
