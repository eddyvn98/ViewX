'use client';

import React, { useRef, memo, useEffect, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { useChartInit } from './hooks/use-chart-init';
import { useChartData } from './hooks/use-chart-data';
// import { useChartCrosshair } from './hooks/use-chart-crosshair';
import { useChartPositions } from './hooks/use-chart-positions';
import { useChartOrders } from './hooks/use-chart-orders';
import { useChartDraftOrder } from './hooks/use-chart-draft-order';
import { useChartIndicators } from './hooks/use-chart-indicators';
import { useChartAlerts } from './hooks/use-chart-alerts';
import { useChartInteraction } from './hooks/use-chart-interaction';

import { ChartOverlay } from './components/ChartOverlay';
import { PositionModifier } from '../terminal/components/PositionModifier';
import { Bell, BellOff, X } from 'lucide-react';

const EMPTY_CANDLES: any[] = [];

export const ChartContainer = memo(function ChartContainer({ chartId }: { chartId: string }) {
    const positions = useMarketStore((state) => state.positions);
    const orders = useMarketStore((state) => state.orders);

    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        price: number;
        nearAlertId?: string;
    } | null>(null);

    const chartInstance = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            if (tab.charts[chartId]) return tab.charts[chartId];
        }
        return null;
    });

    const symbol = chartInstance?.symbol;
    const interval = chartInstance?.interval;
    const source = chartInstance?.source;
    const timezone = chartInstance?.timezone || 'Etc/UTC';

    const normSymbol =
        (symbol || '').toLowerCase().endsWith('m')
            ? symbol!.replace(/[mM]$/, 'm')
            : symbol;

    const key = `${source}:${normSymbol}:${interval}`;
    const candles = useMarketStore((state) => state.candleData[key] || EMPTY_CANDLES);

    /* ================= REFS ================= */
    const priceContainerRef = useRef<HTMLDivElement>(null);
    const subchartContainerRef = useRef<HTMLDivElement>(null);
    const timescaleContainerRef = useRef<HTMLDivElement>(null);

    const { priceChartRef, subchartChartRef, timescaleChartRef, seriesRef, subSyncRef, timescaleSyncRef, syncRange } =
        useChartInit(priceContainerRef, subchartContainerRef, timescaleContainerRef);

    /* ================= DATA ================= */
    useChartData(chartId, symbol, interval, source, priceChartRef, seriesRef, subSyncRef, timescaleSyncRef);

    /* ================= OVERLAYS ================= */
    // useChartCrosshair(chartId, priceChartRef, seriesRef);
    useChartPositions(symbol, seriesRef, positions, priceChartRef);
    useChartOrders(symbol, seriesRef, orders);
    useChartDraftOrder(symbol, seriesRef);

    /* ================= INDICATORS ================= */
    useChartIndicators(
        chartId,
        priceChartRef,
        subchartChartRef,
        seriesRef,
        candles,
        symbol,
        timezone,
        syncRange
    );

    /* ================= ALERTS ================= */
    const {
        alerts,
        handleAddAlertAtPrice,
        handleRemoveAlert,
        handleUpdateAlertPrice,
        getAlertNearPrice,
    } = useChartAlerts(chartId, priceChartRef, seriesRef, symbol);

    useChartInteraction(
        priceChartRef,
        seriesRef,
        symbol,
        priceContainerRef,
        alerts,
        handleUpdateAlertPrice,
        handleRemoveAlert
    );

    /* ================= CONTEXT MENU ================= */
    const handleContextMenu = (e: React.MouseEvent) => {
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

    useEffect(() => {
        const close = () => setContextMenu(null);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, []);

    return (
        <div
            className="w-full h-full relative flex flex-col bg-[#131722]"
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

            {/* PRICE CHART */}
            <div className="flex-[3] relative min-h-0">
                <div ref={priceContainerRef} className="w-full h-full" />
            </div>

            <div className="h-[1px] bg-zinc-800" />

            {/* RSI SUBCHART */}
            <div className="flex-1 relative min-h-0">
                <div ref={subchartContainerRef} className="w-full h-full" />
            </div>

            <div className="h-[1px] bg-zinc-800" />

            {/* TIMESCALE FOOTER */}
            <div className="h-[38px] relative overflow-hidden shrink-0 bg-[#131722]">
                <div ref={timescaleContainerRef} className="w-full h-full" />
            </div>

            {/* CONTEXT MENU */}
            {contextMenu?.visible && (
                <div
                    className="fixed z-50 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-xl py-1 w-48"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {!contextMenu.nearAlertId ? (
                        <button
                            className="w-full text-left px-3 py-2 text-sm text-[#d1d4dc] hover:bg-[#2a2e39] flex items-center gap-2"
                            onClick={() => {
                                handleAddAlertAtPrice(contextMenu.price);
                                setContextMenu(null);
                            }}
                        >
                            <Bell size={14} className="text-orange-500" />
                            Add Alert
                        </button>
                    ) : (
                        <button
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                            onClick={() => {
                                handleRemoveAlert(contextMenu.nearAlertId!);
                                setContextMenu(null);
                            }}
                        >
                            <BellOff size={14} />
                            Remove Alert
                        </button>
                    )}
                    <div className="h-[1px] bg-[#2a2e39] my-1" />
                    <button
                        className="w-full text-left px-3 py-2 text-sm text-[#d1d4dc] hover:bg-[#2a2e39] flex items-center gap-2"
                        onClick={() => setContextMenu(null)}
                    >
                        <X size={14} className="text-zinc-500" />
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
});
