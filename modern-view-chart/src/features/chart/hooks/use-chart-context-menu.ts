import { useState, useEffect } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';

export function useChartContextMenu(
    priceChartRef: React.MutableRefObject<IChartApi | null>,
    priceContainerRef: React.RefObject<HTMLDivElement | null>,
    seriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>,
    getAlertNearPrice: (price: number, x: number) => { id: string } | undefined
) {
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        price: number;
        nearAlertId?: string;
    } | null>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        // Prevent context menu if clicking on a tag
        const target = e.target as HTMLElement;
        if (target.closest('[data-tag-type]')) {
            return;
        }

        e.preventDefault();
        if (!priceChartRef.current || !priceContainerRef.current) return;

        const rect = priceContainerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        const price = seriesRef.current?.coordinateToPrice(y);

        if (price) {
            const nearAlert = getAlertNearPrice(y, x);
            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                price,
                nearAlertId: nearAlert?.id,
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
