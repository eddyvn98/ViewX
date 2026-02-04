'use client';

import React, { useRef, memo, useEffect } from 'react';
import { useMarketStore } from '@/lib/store';
import { useChartInit } from './hooks/use-chart-init';
import { useChartData } from './hooks/use-chart-data';
import { useChartCrosshair } from './hooks/use-chart-crosshair';
import { useChartPositions } from './hooks/use-chart-positions';
import { useChartOrders } from './hooks/use-chart-orders';
import { useChartDraftOrder } from './hooks/use-chart-draft-order';
import { useChartIndicators } from './hooks/use-chart-indicators';
import { useChartRSI } from './hooks/use-chart-rsi';
import { useChartAlerts } from './hooks/use-chart-alerts'; // Import Hook
import { Bell, BellOff, X } from 'lucide-react'; // Import Icons
import { useState } from 'react';

import { useChartInteraction } from './hooks/use-chart-interaction';
import { ChartOverlay } from './components/ChartOverlay';
import { PositionModifier } from '../terminal/components/PositionModifier';
import { cn } from '@/lib/utils';

const EMPTY_CANDLES: any[] = [];

export const ChartContainer = memo(function ChartContainer({ chartId }: { chartId: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const positions = useMarketStore((state) => state.positions);
    const orders = useMarketStore((state) => state.orders);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; price: number; nearAlertId?: string } | null>(null);

    const chartInstance = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            if (tab.charts[chartId]) return tab.charts[chartId];
        }
        return null;
    });

    const symbol = chartInstance?.symbol;
    const interval = chartInstance?.interval;
    const source = chartInstance?.source;

    // KEY NORMALIZATION: Crucial for matching store updates
    const normSymbol = (symbol || "").toLowerCase().endsWith('m') ? symbol!.replace(/[mM]$/, 'm') : symbol;
    const key = `${source}:${normSymbol}:${interval}`;

    // Stabilize selector: avoid returning new [] on every render
    const candles = useMarketStore((state) => state.candleData[key] || EMPTY_CANDLES);

    const { chartRef, seriesRef } = useChartInit(containerRef);

    useChartData(
        chartId,
        symbol,
        interval,
        source,
        chartRef,
        seriesRef
    );

    useChartCrosshair(chartId, chartRef, seriesRef);
    useChartPositions(symbol, seriesRef, positions, chartRef);
    useChartOrders(symbol, seriesRef, orders);
    useChartDraftOrder(symbol, seriesRef);
    useChartIndicators(chartId, chartRef, seriesRef, candles, symbol);
    // Alert Hook
    const { alerts, handleAddAlertAtPrice, handleRemoveAlert, handleUpdateAlertPrice, getAlertNearPrice } = useChartAlerts(chartId, chartRef, seriesRef, symbol);

    useChartInteraction(chartRef, seriesRef, symbol, containerRef, alerts, handleUpdateAlertPrice, handleRemoveAlert);

    // Context Menu Handler
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!chartRef.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;

        // Convert Y to Price
        const price = seriesRef.current?.coordinateToPrice(y);

        if (price) {
            const nearAlert = getAlertNearPrice(y, x);
            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                price,
                nearAlertId: nearAlert?.id
            });
        }
    };

    // Close Menu on Click Elsewhere
    useEffect(() => {
        const checkClose = () => setContextMenu(null);
        window.addEventListener('click', checkClose);
        return () => window.removeEventListener('click', checkClose);
    }, []);

    return (
        <div
            className="w-full h-full relative group/chart"
            onContextMenu={handleContextMenu}
        >
            <ChartOverlay
                chartId={chartId}
                symbol={chartInstance?.symbol}
                interval={chartInstance?.interval}
                source={chartInstance?.source}
                candles={candles}
            />
            <PositionModifier />
            <div ref={containerRef} className="w-full h-full" />

            {/* Context Menu */}
            {contextMenu && contextMenu.visible && (
                <div
                    className="fixed z-50 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-xl py-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {!contextMenu.nearAlertId ? (
                        <button
                            className="w-full text-left px-3 py-2 text-sm text-[#d1d4dc] hover:bg-[#2a2e39] flex items-center gap-2 transition-colors"
                            onClick={() => {
                                handleAddAlertAtPrice(contextMenu.price);
                                setContextMenu(null);
                            }}
                        >
                            <Bell size={14} className="text-orange-500" />
                            <span>Add Alert at {contextMenu.price.toFixed(symbol?.includes('JPY') ? 3 : 5)}</span>
                        </button>
                    ) : (
                        <button
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                            onClick={() => {
                                handleRemoveAlert(contextMenu.nearAlertId!);
                                setContextMenu(null);
                            }}
                        >
                            <BellOff size={14} />
                            <span>Remove Alert</span>
                        </button>
                    )}
                    <div className="h-[1px] bg-[#2a2e39] my-1" />
                    <button
                        className="w-full text-left px-3 py-2 text-sm text-[#d1d4dc] hover:bg-[#2a2e39] flex items-center gap-2 transition-colors"
                        onClick={() => setContextMenu(null)}
                    >
                        <X size={14} className="text-zinc-500" />
                        <span>Cancel</span>
                    </button>
                </div>
            )}
        </div>
    );
});
