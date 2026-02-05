'use client';

import React, { useRef, memo, useEffect, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useChartInit } from './hooks/use-chart-init';
import { useChartData } from './hooks/use-chart-data';
// import { useChartCrosshair } from './hooks/use-chart-crosshair';
import { useChartPositions } from './hooks/use-chart-positions';
import { useChartOrders } from './hooks/use-chart-orders';
import { useChartDraftOrder } from './hooks/use-chart-draft-order';
import { useChartIndicators } from './hooks/use-chart-indicators';
import { useChartAlerts } from './hooks/use-chart-alerts';
import { useChartInteraction } from './hooks/use-chart-interaction';
import { useChartScaleReset } from './hooks/use-chart-scale-reset';

import { ChartOverlay } from './components/ChartOverlay';
import { SubchartLegend } from './components/SubchartLegend';
import { SubchartIndicatorsTabs } from './components/SubchartIndicatorsTabs';
import { PositionModifier } from '../terminal/components/PositionModifier';
import { Bell, BellOff, X, ChevronUp, ChevronDown } from 'lucide-react';

const EMPTY_CANDLES: any[] = [];

export const ChartContainer = memo(function ChartContainer({ chartId }: { chartId: string }) {
    const positions = useMarketStore((state) => state.positions);
    const orders = useMarketStore((state) => state.orders);
    const toggleIndicatorVisibility = useMarketStore(state => state.toggleIndicatorVisibility);

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
    const timezone = chartInstance?.timezone || 'Asia/Ho_Chi_Minh';

    const normSymbol =
        (symbol || '').toLowerCase().endsWith('m')
            ? symbol!.replace(/[mM]$/, 'm')
            : symbol;

    const currentPrice = useMarketStore(state => symbol ? state.tickers[symbol]?.price : undefined);

    const key = `${source}:${normSymbol}:${interval}`;
    const candles = useMarketStore((state) => state.candleData[key] || EMPTY_CANDLES);

    /* ================= REFS ================= */
    const priceContainerRef = useRef<HTMLDivElement>(null);
    const subchartContainerRef = useRef<HTMLDivElement>(null);
    const timescaleContainerRef = useRef<HTMLDivElement>(null);

    const { priceChartRef, subchartChartRef, timescaleChartRef, seriesRef, subSyncRef, timescaleSyncRef, syncRange } =
        useChartInit(priceContainerRef, subchartContainerRef, timescaleContainerRef);

    /* ================= DATA ================= */
    useChartData(chartId, symbol, interval, source, priceChartRef, subchartChartRef, seriesRef, subSyncRef, timescaleSyncRef);

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
        syncRange,
        currentPrice
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

    useChartScaleReset(
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        priceContainerRef,
        subchartContainerRef,
        timescaleContainerRef
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

    const lastSwitchRef = useRef<number>(0);

    // Prevent page scroll when wheeling over subchart to switch indicators
    useEffect(() => {
        const container = subchartContainerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            const indicators = useMarketStore.getState().chartIndicators[chartId] || [];
            const subchartIndicators = indicators.filter(i => i.pane === 'subchart');
            if (subchartIndicators.length <= 1) return;

            // block page scroll early if we have multiple indicators
            e.preventDefault();
            e.stopPropagation();

            const now = Date.now();
            // Threshold: 200ms between switches and significant deltaY to avoid hair-trigger
            if (now - lastSwitchRef.current < 200 || Math.abs(e.deltaY) < 20) return;

            const visibleIndex = subchartIndicators.findIndex(i => i.visible);
            if (e.deltaY === 0) return;
            const direction = e.deltaY > 0 ? 1 : -1;

            let nextIndex = visibleIndex + direction;
            if (nextIndex >= subchartIndicators.length) nextIndex = 0;
            if (nextIndex < 0) nextIndex = subchartIndicators.length - 1;

            if (nextIndex !== visibleIndex) {
                lastSwitchRef.current = now;
                if (visibleIndex !== -1) {
                    toggleIndicatorVisibility(chartId, subchartIndicators[visibleIndex].id);
                }
                toggleIndicatorVisibility(chartId, subchartIndicators[nextIndex].id);

                // Auto-fit the new indicator scale so it's always centered
                requestAnimationFrame(() => {
                    subchartChartRef.current?.priceScale('right').applyOptions({ autoScale: true });
                });
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [chartId, toggleIndicatorVisibility]);

    const [isSubchartVisible, setIsSubchartVisible] = useState(true);

    // Dynamic margin adjustment to keep candles above the subchart overlay
    useEffect(() => {
        if (!priceChartRef.current) return;

        const bottomMargin = isSubchartVisible ? 0.32 : 0.08; // 32% if overlay (25%) is visible
        priceChartRef.current.priceScale('right').applyOptions({
            scaleMargins: {
                top: 0.08,
                bottom: bottomMargin
            }
        });
    }, [isSubchartVisible, priceChartRef]);

    // Apply Timezone to Chart Localization & Scale
    useEffect(() => {
        if (!priceChartRef.current || !timezone) return;

        const timeFormatter = (timestamp: number) => {
            return new Intl.DateTimeFormat('en-GB', {
                timeZone: timezone,
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(timestamp * 1000).replace(',', '');
        };

        const tickMarkFormatter = (time: number) => {
            const date = new Date(time * 1000);
            return new Intl.DateTimeFormat('en-GB', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).format(date);
        };

        const localizationOptions = {
            localization: {
                timeFormatter,
            },
        };

        const timeScaleOptions = {
            timeScale: {
                tickMarkFormatter,
            },
        };

        priceChartRef.current.applyOptions(localizationOptions);
        (priceChartRef.current.timeScale() as any).applyOptions(timeScaleOptions.timeScale);

        if (subchartChartRef.current) {
            subchartChartRef.current.applyOptions(localizationOptions);
            (subchartChartRef.current.timeScale() as any).applyOptions(timeScaleOptions.timeScale);
        }

        if (timescaleChartRef.current) {
            timescaleChartRef.current.applyOptions(localizationOptions);
            (timescaleChartRef.current.timeScale() as any).applyOptions(timeScaleOptions.timeScale);
        }
    }, [timezone, priceChartRef, subchartChartRef, timescaleChartRef]);

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
                currentPrice={currentPrice}
                onReset={() => {
                    if (priceChartRef.current) {
                        const chart = priceChartRef.current;
                        const subchart = subchartChartRef.current;

                        // 1. Reset Price Scales for both charts
                        chart.priceScale('right').applyOptions({ autoScale: true });
                        if (subchart) {
                            subchart.priceScale('right').applyOptions({ autoScale: true });
                        }

                        // 2. Fit Time Scale immediately
                        chart.timeScale().fitContent();

                        // 3. Fit again after a safe delay to allow layout (width) updates to settle
                        // This mimics the human delay between clicks and handles the layout shift
                        setTimeout(() => {
                            chart.timeScale().fitContent();
                        }, 100);
                    }
                }}
            />

            <PositionModifier />

            {/* MAIN CHART AREA WITH OVERLAY */}
            <div className="flex-1 relative min-h-0">
                {/* PRICE CHART (Main) - Always background */}
                <div ref={priceContainerRef} className="w-full h-full" />

                {/* SUBCHART CONTROL PANEL (ASSEMBLY) */}
                <div
                    className={cn(
                        "absolute right-[80px] z-30 flex items-end transition-all duration-300",
                        isSubchartVisible ? "bottom-[25%]" : "bottom-0"
                    )}
                >
                    <SubchartIndicatorsTabs
                        chartId={chartId}
                        isSubchartVisible={isSubchartVisible}
                    />

                    <button
                        onClick={() => setIsSubchartVisible(!isSubchartVisible)}
                        className={cn(
                            "px-4 py-1.5 rounded-tr-lg border border-zinc-700/50 border-b-0 border-l-0 transition-all active:scale-95 flex items-center gap-2 backdrop-blur-md",
                            isSubchartVisible
                                ? "bg-[#1e222d]/90 text-[#787b86] hover:text-blue-400"
                                : "bg-blue-600/20 text-blue-400"
                        )}
                        style={{ marginLeft: '-1px' }}
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                            {isSubchartVisible ? 'Hide' : 'Show Indicator'}
                        </span>
                        {isSubchartVisible ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                </div>

                {/* RSI SUBCHART (Overlay) - Floating at bottom */}
                <div
                    className={`absolute bottom-0 left-0 right-0 h-[25%] min-h-[100px] z-10 bg-[#131722]/50 backdrop-blur-md border-t border-blue-500/30 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] transition-all duration-300 transform ${isSubchartVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
                        }`}
                >
                    {/* Visual Border Highlight */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent shadow-[0_0_8px_rgba(59,130,246,0.5)]" />

                    <SubchartLegend
                        chartId={chartId}
                        symbol={chartInstance?.symbol}
                        interval={chartInstance?.interval}
                        source={chartInstance?.source}
                        candles={candles}
                        currentPrice={currentPrice}
                    />
                    <div ref={subchartContainerRef} className="w-full h-full" />
                </div>
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
