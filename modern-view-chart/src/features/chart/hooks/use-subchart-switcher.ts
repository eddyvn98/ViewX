import { useRef, useEffect } from 'react';
import { useMarketStore } from '@/lib/store';

export function useSubchartSwitcher(
    chartId: string,
    subchartContainerRef: React.RefObject<HTMLDivElement | null>
) {
    const toggleIndicatorVisibility = useMarketStore(state => state.toggleIndicatorVisibility);
    const lastSwitchRef = useRef<number>(0);

    // Unified Indicator Switch Logic (Swipe & Scroll)
    useEffect(() => {
        const container = subchartContainerRef.current;
        if (!container) return;

        const switchIndicator = (direction: 1 | -1) => {
            const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
            const subchartIndicators = indicators.filter(i => i.pane === 'subchart');
            if (subchartIndicators.length <= 1) return;

            const visibleIndex = subchartIndicators.findIndex(i => i.visible);

            let nextIndex = visibleIndex + direction;
            if (nextIndex >= subchartIndicators.length) nextIndex = 0;
            if (nextIndex < 0) nextIndex = subchartIndicators.length - 1;

            if (nextIndex !== visibleIndex) {
                const state = useMarketStore.getState();
                const activeTab = state.tabs[state.activeTabId];
                const isSubchartVisible = activeTab?.charts[chartId]?.isSubchartVisible ?? true;

                if (!isSubchartVisible) return;

                lastSwitchRef.current = Date.now();
                if (visibleIndex !== -1) {
                    toggleIndicatorVisibility(chartId, subchartIndicators[visibleIndex].id);
                }
                toggleIndicatorVisibility(chartId, subchartIndicators[nextIndex].id);
            }
        };

        const handleWheel = (e: WheelEvent) => {
            const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
            const subchartIndicators = indicators.filter(i => i.pane === 'subchart');
            if (subchartIndicators.length <= 1) return;

            e.preventDefault();
            e.stopPropagation();

            const now = Date.now();
            if (now - lastSwitchRef.current < 200 || Math.abs(e.deltaY) < 20) return;

            if (e.deltaY === 0) return;
            switchIndicator(e.deltaY > 0 ? 1 : -1);
        };

        // Touch Handling for Mobile Swipe
        let touchStartY = 0;
        let touchStartX = 0;
        let isTouchOnScale = false;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;

            // Avoid conflict: If touch starts on the right scale area (last 80px),
            // don't trigger indicator switch.
            const rect = container.getBoundingClientRect();
            const xInContainer = touchStartX - rect.left;
            isTouchOnScale = xInContainer > container.clientWidth - 80;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (isTouchOnScale) return;

            const touchEndY = e.changedTouches[0].clientY;
            const touchEndX = e.changedTouches[0].clientX;

            const diffY = touchEndY - touchStartY;
            const diffX = touchEndX - touchStartX;

            // Detect vertical swipe (ignore if panning horizontally)
            if (Math.abs(diffY) > 50 && Math.abs(diffX) < 40) {
                // Swipe Down (positive diffY) -> Prev (-1)
                // Swipe Up (negative diffY) -> Next (1)
                switchIndicator(diffY < 0 ? 1 : -1);
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [chartId, toggleIndicatorVisibility, subchartContainerRef]);
}
