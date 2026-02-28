import { useState, useEffect } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';

export function useChartContextMenu(
    priceChartRef: React.MutableRefObject<IChartApi | null>,
    priceContainerRef: React.RefObject<HTMLDivElement | null>,
    seriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>,
    getAlertNearPrice: ((price: number, x: number) => { id: string } | undefined) | undefined,
    getHitItem?: (y: number, x: number) => { type: 'entry' | 'sl' | 'tp' | 'alert' | 'limit'; id?: string; ticket?: number | string; price: number; } | null
) {
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        price: number;
        nearAlertId?: string;
        hitItem?: {
            type: 'entry' | 'sl' | 'tp' | 'alert' | 'limit';
            id?: string;
            ticket?: number | string;
            price: number;
        };
    } | null>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        // 🛡️ Always prevent default on chart interaction to avoid browser context menu on mobile
        e.preventDefault();

        const target = e.target as HTMLElement;
        // Ignore if clicking on a tag OR the edit overlay components
        if (target.closest('[data-tag-id], [data-is-tag], [data-tag-type], .tag-body, .delete-btn, .edit-overlay')) {
            return;
        }

        if (!priceChartRef.current || !priceContainerRef.current) return;

        const rect = priceContainerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        const price = seriesRef.current?.coordinateToPrice(y);

        if (price) {
            const nearAlert = getAlertNearPrice ? getAlertNearPrice(y, x) : undefined;
            const hitItem = getHitItem ? getHitItem(y, x) : null;

            // 📱 On mobile, don't show the menu for "Add Alert" (empty space)
            // Long-press often triggers this accidentally. Only show if hitting a position/order/alert.
            const isMobile = window.innerWidth < 768;
            if (isMobile && !nearAlert && !hitItem) {
                return;
            }

            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                price,
                nearAlertId: nearAlert?.id,
                hitItem: hitItem || undefined
            });
        }
    };

    const closeContextMenu = () => setContextMenu(null);

    useEffect(() => {
        window.addEventListener('click', closeContextMenu);
        return () => window.removeEventListener('click', closeContextMenu);
    }, []);

    return {
        contextMenu,
        handleContextMenu,
        closeContextMenu,
        setContextMenu
    };
}
