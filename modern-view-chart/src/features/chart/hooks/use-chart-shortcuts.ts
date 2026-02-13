import { useEffect } from 'react';
import { useMarketStore } from '@/lib/store';

export function useChartShortcuts(chartId: string) {
    const updateChart = useMarketStore(state => state.updateChart);
    const addNotification = useMarketStore(state => state.addNotification);

    const activeChartId = useMarketStore(state => {
        const activeTab = state.activeTabId ? state.tabs[state.activeTabId] : null;
        return activeTab?.activeChartId;
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if this chart is active and no inputs are focused
            if (activeChartId !== chartId) return;

            const isInput = document.activeElement instanceof HTMLInputElement ||
                document.activeElement instanceof HTMLTextAreaElement ||
                (document.activeElement as HTMLElement)?.isContentEditable;

            if (isInput) return;

            const key = e.key.toLowerCase();

            if (key === 'r') {
                // updateChart(chartId, { source: 'real' });
                // addNotification('Chart Switched to REAL', 'warning');
            } else if (key === 'm') {
                updateChart(chartId, { source: 'MT5' });
                addNotification('Chart Switched to DEMO (MT5)', 'info');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [chartId, activeChartId, updateChart, addNotification]);
}
